import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status, Response, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
import bcrypt
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from models.database import AsyncSessionLocal
from models.user import User
from models.password_reset import UserOTP, PasswordResetToken
from services.auth_security import (
    generate_secure_otp,
    hash_otp,
    verify_otp,
    generate_reset_token,
    verify_reset_token,
    validate_password_complexity,
)
from services.mailer import send_otp_email
from middleware.rate_limiter import limiter

router = APIRouter(prefix="/auth", tags=["auth"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login")

SECRET_KEY = settings.jwt_secret_key
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

OTP_EXPIRY_MINUTES = 10
RESET_TOKEN_EXPIRY_MINUTES = 15
MAX_OTP_ATTEMPTS = 3


# ---------------------------------------------------------------------------
# Database dependency
# ---------------------------------------------------------------------------

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


# ---------------------------------------------------------------------------
# Password helpers
# ---------------------------------------------------------------------------

def verify_password(plain_password, hashed_password):
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_password_hash(password):
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


# ---------------------------------------------------------------------------
# JWT helpers  (session_version is embedded as "sv" claim)
# ---------------------------------------------------------------------------

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)

class UserResponse(BaseModel):
    id: uuid.UUID
    email: EmailStr
    is_active: bool

    class Config:
        from_attributes = True

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    password_reset_token: str = Field(..., min_length=16, max_length=128)
    new_password: str = Field(..., min_length=8, max_length=128)


# ---------------------------------------------------------------------------
# Auth middleware — validates session_version to kill zombie sessions
# ---------------------------------------------------------------------------

async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get("access_token")
    if not token:
        authorization: str = request.headers.get("Authorization")
        if authorization and authorization.startswith("Bearer "):
            token = authorization.split(" ")[1]

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        token_sv: int = payload.get("sv")  # session_version embedded at login
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalars().first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    # ── Zombie-session check ──────────────────────────────────────────────
    # If the user's session_version has been bumped (e.g. after a password
    # reset), any JWT carrying the old version is immediately rejected.
    if token_sv is not None and token_sv != user.session_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session invalidated. Please log in again.",
        )

    return user


def require_role(allowed_roles: list[str]):
    """
    Dependency that enforces Role-Based Access Control (RBAC).
    """
    async def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient Permissions"
            )
        return current_user
    return role_checker


# ═══════════════════════════════════════════════════════════════════════════
# EXISTING ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/register", response_model=UserResponse)
@limiter.limit("5/minute")
async def register(request: Request, user: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == user.email))
    db_user = result.scalars().first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = get_password_hash(user.password)
    new_user = User(email=user.email, hashed_password=hashed_password)
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user

@router.post("/login")
@limiter.limit("5/minute")
async def login(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalars().first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id), "sv": user.session_version},
        expires_delta=access_token_expires,
    )

    # Cross-site cookie flags. When the frontend is on a different domain than
    # this API (the production setup — e.g. Vercel frontend + separate backend
    # host), the browser only sends the cookie on cross-site requests if it is
    # SameSite=None AND Secure. Locally (same-site over http) that combo is
    # rejected, so fall back to Lax. `secure` tracks the same production flag,
    # keeping the required None+Secure pairing consistent.
    cookie_samesite = "none" if settings.is_production else "lax"

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        expires=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite=cookie_samesite,
        secure=settings.is_production,
    )

    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/logout")
async def logout(response: Response):
    # Match the attributes used when the cookie was set, or the browser may
    # refuse to clear it.
    response.delete_cookie(
        "access_token",
        samesite="none" if settings.is_production else "lax",
        secure=settings.is_production,
        httponly=True,
    )
    return {"message": "Logged out successfully"}

@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user


# ═══════════════════════════════════════════════════════════════════════════
# FORGOT PASSWORD FLOW — 3 hardened endpoints
# ═══════════════════════════════════════════════════════════════════════════


# ── Step 1: Request OTP ───────────────────────────────────────────────────

@router.post("/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Initiate the password-reset flow.

    **Security:**
      • Always returns 200 with an identical message regardless of whether the
        email exists. This prevents email-enumeration attacks.
      • Invalidates (deletes) any existing OTPs for the user before creating a
        new one, preventing stale-OTP accumulation.
    """
    # Constant-time-safe response — even if the user doesn't exist.
    SAFE_RESPONSE = {
        "message": "If an account matches that email, an OTP has been sent."
    }

    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalars().first()

    if not user:
        # Do NOT leak that the email doesn't exist.
        return SAFE_RESPONSE

    # Invalidate all previous OTPs for this user (prevents replay of old codes).
    await db.execute(delete(UserOTP).where(UserOTP.user_id == user.id))

    # Generate, hash, and persist the new OTP.
    plain_otp = generate_secure_otp()
    otp_hash = hash_otp(plain_otp)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES)

    new_otp = UserOTP(
        user_id=user.id,
        hashed_otp=otp_hash,
        expires_at=expires_at,
    )
    db.add(new_otp)
    await db.commit()

    # Send the OTP email as a background task (non-blocking).
    background_tasks.add_task(send_otp_email, body.email, plain_otp)

    return SAFE_RESPONSE


# ── Step 2: Verify OTP ───────────────────────────────────────────────────

@router.post("/verify-otp")
async def verify_otp_endpoint(
    body: VerifyOTPRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Verify the 6-digit OTP submitted by the user.

    **Security:**
      • Checks expiry first (expired OTP → 400).
      • Tracks failed attempts — locks after MAX_OTP_ATTEMPTS (→ 403).
      • Uses constant-time bcrypt comparison.
      • On success, marks the OTP as used (replay prevention) and issues a
        cryptographically secure password-reset token (32-byte hex).
    """
    # Look up user by email.
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalars().first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email or OTP.",
        )

    # Fetch the latest unused OTP for this user.
    result = await db.execute(
        select(UserOTP)
        .where(
            UserOTP.user_id == user.id,
            UserOTP.is_used == False,  # noqa: E712 — SQLAlchemy requires ==
        )
        .order_by(UserOTP.created_at.desc())
        .limit(1)
    )
    otp_record = result.scalars().first()

    if not otp_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active OTP found. Please request a new one.",
        )

    # ── Expiry check ──────────────────────────────────────────────────────
    if datetime.now(timezone.utc) > otp_record.expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP has expired. Please request a new one.",
        )

    # ── Brute-force lockout ───────────────────────────────────────────────
    if otp_record.failed_attempts >= MAX_OTP_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Too many failed attempts. This OTP has been locked. Please request a new one.",
        )

    # ── Constant-time hash comparison ─────────────────────────────────────
    if not verify_otp(body.otp, otp_record.hashed_otp):
        otp_record.failed_attempts += 1
        await db.commit()
        remaining = MAX_OTP_ATTEMPTS - otp_record.failed_attempts
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid OTP. {remaining} attempt(s) remaining.",
        )

    # ── Success: mark OTP as consumed (replay prevention) ─────────────────
    otp_record.is_used = True
    await db.commit()

    # ── Issue a password-reset token ──────────────────────────────────────
    # Invalidate any existing reset tokens for this user.
    await db.execute(
        delete(PasswordResetToken).where(PasswordResetToken.user_id == user.id)
    )

    plain_token, hashed_token = generate_reset_token()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_EXPIRY_MINUTES)

    new_token = PasswordResetToken(
        user_id=user.id,
        hashed_token=hashed_token,
        expires_at=expires_at,
    )
    db.add(new_token)
    await db.commit()

    return {
        "message": "OTP verified successfully.",
        "password_reset_token": plain_token,
    }


# ── Step 3: Reset Password ───────────────────────────────────────────────

@router.post("/reset-password")
async def reset_password(
    body: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Set a new password using a verified reset token.

    **Security:**
      • Validates password complexity (min 8, 1 digit, 1 special char).
      • Verifies the reset token is valid and unexpired (constant-time bcrypt).
      • Hashes the new password with bcrypt before storage.
      • Increments ``session_version`` on the user — this instantly invalidates
        every previously-issued JWT across all devices (zombie-session kill).
      • Deletes the consumed reset token (replay prevention).
    """
    # ── Password complexity validation ────────────────────────────────────
    try:
        validate_password_complexity(body.new_password)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )

    # ── Look up user ──────────────────────────────────────────────────────
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalars().first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid request.",
        )

    # ── Look up the latest unused reset token for this user ───────────────
    result = await db.execute(
        select(PasswordResetToken)
        .where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.is_used == False,  # noqa: E712
        )
        .order_by(PasswordResetToken.created_at.desc())
        .limit(1)
    )
    token_record = result.scalars().first()

    if not token_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token.",
        )

    # ── Expiry check ──────────────────────────────────────────────────────
    if datetime.now(timezone.utc) > token_record.expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired. Please start the process again.",
        )

    # ── Constant-time hash comparison ─────────────────────────────────────
    if not verify_reset_token(body.password_reset_token, token_record.hashed_token):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token.",
        )

    # ── Apply the password change ─────────────────────────────────────────
    user.hashed_password = get_password_hash(body.new_password)

    # Bump session_version → all JWTs carrying the old "sv" are now invalid.
    user.session_version += 1

    # Mark the token as consumed (replay prevention).
    token_record.is_used = True

    # Clean up: delete all reset tokens + OTPs for this user.
    await db.execute(delete(PasswordResetToken).where(PasswordResetToken.user_id == user.id))
    await db.execute(delete(UserOTP).where(UserOTP.user_id == user.id))

    await db.commit()

    return {"message": "Password has been reset successfully. Please log in with your new password."}

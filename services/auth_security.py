"""
Cryptographic utilities for the password-reset flow.
─────────────────────────────────────────────────────
All random values are generated via Python's `secrets` module (CSPRNG).
OTPs and reset tokens are bcrypt-hashed before database storage.

Uses the `bcrypt` library directly (same as the main auth module) to avoid
the passlib + bcrypt>=4.1 incompatibility.
"""

import re
import secrets

import bcrypt


# ---------------------------------------------------------------------------
# OTP Generation
# ---------------------------------------------------------------------------

def generate_secure_otp() -> str:
    """
    Generate a cryptographically secure 6-digit OTP.

    Uses ``secrets.SystemRandom()`` — backed by the OS CSPRNG — instead of the
    Mersenne-Twister-based ``random`` module which is statistically predictable.
    """
    rng = secrets.SystemRandom()
    code = rng.randint(0, 999_999)
    return f"{code:06d}"


# ---------------------------------------------------------------------------
# OTP Hashing / Verification
# ---------------------------------------------------------------------------

def hash_otp(otp: str) -> str:
    """Hash an OTP string with bcrypt before saving to the database."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(otp.encode("utf-8"), salt).decode("utf-8")


def verify_otp(plain_otp: str, hashed_otp: str) -> bool:
    """
    Constant-time bcrypt comparison between a plain OTP and its stored hash.

    Returns ``True`` on match; ``False`` otherwise. The bcrypt comparison is
    inherently constant-time, preventing timing-based side-channel attacks.
    """
    return bcrypt.checkpw(plain_otp.encode("utf-8"), hashed_otp.encode("utf-8"))


# ---------------------------------------------------------------------------
# Password-Reset Token Generation / Verification
# ---------------------------------------------------------------------------

def generate_reset_token() -> tuple[str, str]:
    """
    Generate a 32-byte hex password-reset token and its bcrypt hash.

    Returns:
        (plain_token, hashed_token) — the plain token is sent to the client;
        only the hash is persisted in the database.
    """
    plain_token = secrets.token_hex(32)          # 64 hex chars = 256 bits
    salt = bcrypt.gensalt()
    hashed_token = bcrypt.hashpw(plain_token.encode("utf-8"), salt).decode("utf-8")
    return plain_token, hashed_token


def verify_reset_token(plain_token: str, hashed_token: str) -> bool:
    """Constant-time bcrypt comparison for reset tokens."""
    return bcrypt.checkpw(plain_token.encode("utf-8"), hashed_token.encode("utf-8"))


# ---------------------------------------------------------------------------
# Password Complexity Validation
# ---------------------------------------------------------------------------

_SPECIAL_CHARS_PATTERN = re.compile(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>/?`~]")


def validate_password_complexity(password: str) -> None:
    """
    Enforce enterprise password-complexity rules.

    Raises ``ValueError`` with a descriptive message on failure.

    Rules:
      • Minimum 8 characters.
      • At least 1 digit.
      • At least 1 special character.
    """
    errors: list[str] = []

    if len(password) < 8:
        errors.append("Password must be at least 8 characters long.")
    if not any(ch.isdigit() for ch in password):
        errors.append("Password must contain at least 1 digit.")
    if not _SPECIAL_CHARS_PATTERN.search(password):
        errors.append("Password must contain at least 1 special character.")

    if errors:
        raise ValueError(" ".join(errors))

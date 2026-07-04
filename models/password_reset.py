"""
Password Reset ORM Models
─────────────────────────
UserOTP         – stores hashed 6-digit OTPs with expiry + attempt tracking.
PasswordResetToken – stores hashed reset tokens issued after OTP verification.

Both tables are FK-linked to users and use CASCADE deletes.
"""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from models.database import Base


class UserOTP(Base):
    """
    Stores hashed OTPs for the forgot-password flow.

    Security invariants:
      • OTP is bcrypt-hashed before storage — never stored in plaintext.
      • Expires 10 minutes after creation.
      • Locked after 3 failed verification attempts.
      • Marked is_used=True on successful verification to prevent replay.
    """

    __tablename__ = "user_otps"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    hashed_otp: Mapped[str] = mapped_column(String(255), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    failed_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_user_otps_user_id", "user_id"),
    )


class PasswordResetToken(Base):
    """
    Stores hashed password-reset tokens issued after successful OTP verification.

    Security invariants:
      • Token is a 32-byte cryptographically random hex string, bcrypt-hashed before storage.
      • Expires 15 minutes after creation.
      • Marked is_used=True on consumption to prevent replay.
    """

    __tablename__ = "password_reset_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    hashed_token: Mapped[str] = mapped_column(String(255), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    is_used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_password_reset_tokens_user_id", "user_id"),
    )

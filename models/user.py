import uuid
from datetime import datetime

from sqlalchemy import String, Boolean, DateTime, Integer, func, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from models.database import Base

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Incremented on every password reset to invalidate all previously-issued JWTs.
    session_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")

    # Role-Based Access Control (RBAC)
    role: Mapped[str] = mapped_column(String(50), nullable=False, default="Analyst", server_default="Analyst")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=func.now(),
        nullable=False
    )

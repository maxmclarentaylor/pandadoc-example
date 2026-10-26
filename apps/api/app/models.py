"""SQLAlchemy models. Schema changes go through Alembic."""

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, LargeBinary, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.orm import Base


class Page(Base):
    __tablename__ = "pages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    owner_oid: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    chunks: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False)
    y_state: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)
    locked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    content_hash: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # True once the sender has "sent" for signature. Real email comes later.
    emails_sent: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    # True once every assignee has signed and every signature chunk is filled.
    signing_complete: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    # Set in the same commit that seals the final PDF. Null until then.
    sealed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    pdf_bytes: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)
    pdf_hash: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    assignees: Mapped[list["PageAssignee"]] = relationship(
        back_populates="page",
        cascade="all, delete-orphan",
        order_by="PageAssignee.sort_order",
    )


class PageAssignee(Base):
    """Someone invited to sign a locked page. Emails are not sent yet."""

    __tablename__ = "page_assignees"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    page_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("pages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    email: Mapped[str] = mapped_column(Text, nullable=False)
    # Demo-only: Entra UPN this invitee will sign in as (not used in real production).
    demo_entra_upn: Mapped[str] = mapped_column(Text, nullable=False, default="")
    signed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    page: Mapped["Page"] = relationship(back_populates="assignees")


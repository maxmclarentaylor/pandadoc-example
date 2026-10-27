"""Request and response bodies for page routes."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator


class ChunkIn(BaseModel):
    id: str
    type: str
    model_config = {"extra": "allow"}


class PageWrite(BaseModel):
    title: str = ""
    chunks: list[ChunkIn] = Field(default_factory=list)


class SigningFieldsWrite(BaseModel):
    """Locked-page updates allowed while signing: signature/date chunks only."""

    chunks: list[ChunkIn] = Field(default_factory=list)


class PageSummary(BaseModel):
    id: str
    title: str
    locked: bool = False
    emails_sent: bool = False
    signing_complete: bool = False


class PageOut(BaseModel):
    id: str
    title: str
    chunks: list[dict[str, Any]]
    locked: bool = False
    content_hash: str | None = None
    emails_sent: bool = False
    signing_complete: bool = False
    sealed: bool = False
    sealed_at: datetime | None = None
    pdf_hash: str | None = None
    has_pdf: bool = False


class SealCheckOut(BaseModel):
    """Result of checking the signature embedded in the stored PDF."""

    id: str
    intact: bool
    field_name: str | None
    certificate_name: str | None
    self_signed: bool
    sealed_at: datetime | None


class PageIntegrityOut(BaseModel):
    """Re-hash the frozen snapshot and compare to the stored fingerprint."""

    id: str
    locked: bool
    content_hash: str | None
    computed_hash: str
    matches: bool


# Local-demo Entra users only. Production would not map invitees this way.
DEMO_ENTRA_UPNS = frozenset(
    {
        "editor1@maxmclarentayloroutlook.onmicrosoft.com",
        "editor2@maxmclarentayloroutlook.onmicrosoft.com",
    }
)


class AssigneeIn(BaseModel):
    name: str = ""
    email: str = ""
    demo_entra_upn: str = ""

    @field_validator("name")
    @classmethod
    def name_required(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Name is required")
        return cleaned

    @field_validator("email")
    @classmethod
    def email_required(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned or "@" not in cleaned or "." not in cleaned.split("@")[-1]:
            raise ValueError("A valid email is required")
        return cleaned.lower()

    @field_validator("demo_entra_upn")
    @classmethod
    def demo_login_required(cls, value: str) -> str:
        cleaned = value.strip().lower()
        if cleaned not in DEMO_ENTRA_UPNS:
            raise ValueError("Pick a demo Entra user (Editor One or Editor Two)")
        return cleaned


class AssigneeOut(BaseModel):
    id: str
    name: str
    email: str
    demo_entra_upn: str
    signed_at: datetime | None = None
    sort_order: int


class AssigneesWrite(BaseModel):
    assignees: list[AssigneeIn] = Field(default_factory=list)

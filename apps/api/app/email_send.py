"""Outbound email via Resend. Config comes from environment variables."""

from __future__ import annotations

import logging
import os
from typing import Any

log = logging.getLogger(__name__)


class EmailConfigError(RuntimeError):
    """Required email settings are missing or invalid."""


class EmailSendError(RuntimeError):
    """The provider rejected or failed a send."""


def _require(name: str) -> str:
    value = (os.getenv(name) or "").strip()
    if not value:
        raise EmailConfigError(f"{name} is not set")
    return value


def app_public_url() -> str:
    return _require("APP_PUBLIC_URL").rstrip("/")


def signing_link(page_id: str) -> str:
    return f"{app_public_url()}/pages-to-sign/{page_id}"


def send_email(*, to: str, subject: str, html: str) -> dict[str, Any]:
    """Send one HTML email with Resend (same shape as their quickstart)."""
    backend = (os.getenv("EMAIL_BACKEND") or "resend").strip().lower()
    if backend != "resend":
        raise EmailConfigError(f"Unsupported EMAIL_BACKEND={backend!r}")

    api_key = _require("RESEND_API_KEY")
    from_addr = _require("EMAIL_FROM")

    import resend

    resend.api_key = api_key
    try:
        result = resend.Emails.send(
            {
                "from": from_addr,
                "to": [to],
                "subject": subject,
                "html": html,
            }
        )
    except Exception as exc:  # noqa: BLE001 — surface provider errors to the API layer
        raise EmailSendError(str(exc)) from exc

    if isinstance(result, dict):
        return result
    return {"id": getattr(result, "id", None)}


def send_signing_invite(*, to: str, name: str, page_title: str, page_id: str) -> dict[str, Any]:
    link = signing_link(page_id)
    safe_name = name.strip() or "there"
    subject = f"Please sign: {page_title}"
    html = (
        f"<p>Hi {safe_name},</p>"
        f"<p>You have been asked to sign <strong>{page_title}</strong>.</p>"
        f'<p><a href="{link}">Open the document</a></p>'
        f"<p>If the button does not work, copy this link:<br>{link}</p>"
    )
    log.info("Sending signing invite to %s for page %s", to, page_id)
    return send_email(to=to, subject=subject, html=html)

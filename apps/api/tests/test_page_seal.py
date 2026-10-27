"""The request that finishes signing seals the PDF before it commits."""

from datetime import datetime, timezone
from io import BytesIO

from asn1crypto import x509 as asn1_x509
from cryptography import x509
from cryptography.hazmat.primitives.serialization import Encoding
from pyhanko.pdf_utils.reader import PdfFileReader
from pyhanko.sign.validation import validate_pdf_signature
from pyhanko_certvalidator import ValidationContext

from app.auth import require_entra_user
from app.main import app
from app.models import Page
from app.page_pdf import CompletionRecord, CompletionSigner, page_to_html
from app.page_seal import inspect_seal, seal_pdf


def _minimal_pdf() -> bytes:
    """A one-page PDF pyHanko can open. Avoids WeasyPrint's native libraries."""
    header = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"
    parts = [
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] >>\nendobj\n",
    ]
    offsets: list[int] = []
    out = bytearray(header)
    for part in parts:
        offsets.append(len(out))
        out.extend(part)
    xref_at = len(out)
    out.extend(f"xref\n0 {len(parts) + 1}\n".encode())
    out.extend(b"0000000000 65535 f \n")
    for offset in offsets:
        out.extend(f"{offset:010d} 00000 n \n".encode())
    out.extend(
        (
            f"trailer\n<< /Size {len(parts) + 1} /Root 1 0 R >>\n"
            f"startxref\n{xref_at}\n%%EOF\n"
        ).encode()
    )
    return bytes(out)


EDITOR_1 = "editor1@maxmclarentayloroutlook.onmicrosoft.com"
EDITOR_2 = "editor2@maxmclarentayloroutlook.onmicrosoft.com"
SIG = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


def test_seal_pdf_signs_rendered_bytes(monkeypatch, tmp_path):
    monkeypatch.setenv("PDF_SEAL_CERT_FILE", str(tmp_path / "cert.pem"))
    monkeypatch.setenv("PDF_SEAL_KEY_FILE", str(tmp_path / "key.pem"))

    sealed = seal_pdf(_minimal_pdf())
    reader = PdfFileReader(BytesIO(sealed))
    assert len(reader.embedded_signatures) == 1
    cert = x509.load_pem_x509_certificate((tmp_path / "cert.pem").read_bytes())
    trust_root = asn1_x509.Certificate.load(cert.public_bytes(Encoding.DER))
    signature_status = validate_pdf_signature(
        reader.embedded_signatures[0],
        ValidationContext(trust_roots=[trust_root], allow_fetching=False),
    )
    assert signature_status.intact
    assert signature_status.valid
    inspection = inspect_seal(sealed)
    assert inspection.intact
    assert inspection.field_name == "PageSeal"
    assert inspection.certificate_name == "segment-practice page seal"
    assert inspection.self_signed is True


def test_completion_page_records_signers():
    sealed_at = datetime(2026, 10, 26, 16, 20, tzinfo=timezone.utc)
    signed_at = datetime(2026, 10, 26, 16, 5, tzinfo=timezone.utc)
    html = page_to_html(
        "Contract",
        [{"id": "c1", "type": "text", "text": "Terms"}],
        CompletionRecord(
            content_hash="abc123",
            sealed_at=sealed_at,
            signers=[CompletionSigner(name="Ada Lovelace", email="ada@example.com", signed_at=signed_at)],
        ),
    )
    assert "Completion certificate" in html
    assert "abc123" in html
    assert "Ada Lovelace" in html
    assert "ada@example.com" in html
    assert "2026-10-26 16:05 UTC" in html
    assert "2026-10-26 16:20 UTC" in html
    assert "self-signed for the demo" in html


def _claims(upn: str):
    def _override() -> dict:
        return {"oid": upn, "preferred_username": upn, "name": upn}

    return _override


def test_completing_signature_seals_the_pdf(client, auth_header, db, monkeypatch, tmp_path):
    monkeypatch.setenv("PDF_SEAL_CERT_FILE", str(tmp_path / "cert.pem"))
    monkeypatch.setenv("PDF_SEAL_KEY_FILE", str(tmp_path / "key.pem"))

    draft = [
        {"id": "c1", "type": "text", "text": "Terms"},
        {"id": "s1", "type": "signature", "dataUrl": ""},
    ]
    signed = [
        {"id": "c1", "type": "text", "text": "Terms"},
        {"id": "s1", "type": "signature", "dataUrl": SIG},
    ]
    created = client.post(
        "/v1/pages",
        headers=auth_header,
        json={"title": "Contract", "chunks": draft},
    )
    assert created.status_code == 201
    page_id = created.json()["id"]
    assert created.json()["sealed"] is False
    assert created.json()["sealed_at"] is None

    try:
        locked = client.post(
            f"/v1/pages/{page_id}/lock",
            headers=auth_header,
            json={"title": "Contract", "chunks": draft},
        )
        assert locked.status_code == 200
        assert locked.json()["sealed"] is False

        saved = client.put(
            f"/v1/pages/{page_id}/assignees",
            headers=auth_header,
            json={
                "assignees": [
                    {
                        "name": "Editor One",
                        "email": "one@example.com",
                        "demo_entra_upn": EDITOR_1,
                    },
                    {
                        "name": "Editor Two",
                        "email": "two@example.com",
                        "demo_entra_upn": EDITOR_2,
                    },
                ]
            },
        )
        assert saved.status_code == 200

        page = db.get(Page, page_id)
        assert page is not None
        page.emails_sent = True
        db.commit()

        app.dependency_overrides[require_entra_user] = _claims(EDITOR_1)
        first = client.post(
            f"/v1/pages/{page_id}/signing-fields",
            headers=auth_header,
            json={"chunks": signed},
        )
        assert first.status_code == 200
        assert first.json()["signing_complete"] is False
        assert first.json()["sealed"] is False
        assert first.json()["sealed_at"] is None

        app.dependency_overrides[require_entra_user] = _claims(EDITOR_2)
        second = client.post(
            f"/v1/pages/{page_id}/signing-fields",
            headers=auth_header,
            json={"chunks": signed},
        )
        assert second.status_code == 200, second.text
        body = second.json()
        assert body["signing_complete"] is True
        assert body["sealed"] is True
        assert body["sealed_at"]

        fetched = client.get(f"/v1/pages/{page_id}", headers=auth_header)
        assert fetched.status_code == 200
        assert fetched.json()["sealed"] is True

        downloaded = client.get(f"/v1/pages/{page_id}/pdf", headers=auth_header)
        assert downloaded.status_code == 200
        reader = PdfFileReader(BytesIO(downloaded.content))
        assert len(reader.embedded_signatures) == 1
        cert = x509.load_pem_x509_certificate((tmp_path / "cert.pem").read_bytes())
        trust_root = asn1_x509.Certificate.load(cert.public_bytes(Encoding.DER))
        signature_status = validate_pdf_signature(
            reader.embedded_signatures[0],
            ValidationContext(trust_roots=[trust_root], allow_fetching=False),
        )
        assert signature_status.intact
        assert signature_status.valid

        app.dependency_overrides[require_entra_user] = _claims("test@example.com")
        unlocked = client.post(f"/v1/pages/{page_id}/unlock", headers=auth_header, json={})
        assert unlocked.status_code == 200
        assert unlocked.json()["sealed"] is False
        assert unlocked.json()["sealed_at"] is None
        assert unlocked.json()["signing_complete"] is False
    finally:
        row = db.get(Page, page_id)
        if row is not None:
            db.delete(row)
            db.commit()

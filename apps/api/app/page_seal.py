"""PAdES seal for a completed page PDF.

Uses a certificate and key from the environment when set. Otherwise generates
a self-signed demo certificate on first use (not a publicly trusted CA).
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID
from pyhanko.pdf_utils.incremental_writer import IncrementalPdfFileWriter
from pyhanko.sign import signers

log = logging.getLogger(__name__)

_API_ROOT = Path(__file__).resolve().parents[1]
_DEFAULT_DIR = _API_ROOT / "var" / "seal"


class SealError(Exception):
    """The PDF could not be sealed."""


def seal_pdf(pdf: bytes) -> bytes:
    """Embed a digital signature in the PDF. Raises SealError when that fails."""
    try:
        signer = _load_signer()
        writer = IncrementalPdfFileWriter(BytesIO(pdf))
        output = BytesIO()
        signers.sign_pdf(
            writer,
            signers.PdfSignatureMetadata(
                field_name="PageSeal",
                reason="All assignees have signed",
                name="segment-practice",
            ),
            signer=signer,
            output=output,
        )
    except SealError:
        raise
    except Exception as exc:
        raise SealError(str(exc)) from exc

    sealed = output.getvalue()
    if not sealed.startswith(b"%PDF"):
        raise SealError("Sealing did not produce a PDF")
    return sealed


def _load_signer() -> signers.SimpleSigner:
    cert_path, key_path = _material_paths()
    _ensure_material(cert_path, key_path)
    passphrase = os.getenv("PDF_SEAL_KEY_PASSPHRASE", "").strip()
    signer = signers.SimpleSigner.load(
        str(key_path),
        str(cert_path),
        key_passphrase=passphrase.encode("utf-8") if passphrase else None,
    )
    if signer is None:
        raise SealError("Could not load the seal certificate and key")
    return signer


def _material_paths() -> tuple[Path, Path]:
    cert = os.getenv("PDF_SEAL_CERT_FILE", "").strip()
    key = os.getenv("PDF_SEAL_KEY_FILE", "").strip()
    if cert or key:
        if not cert or not key:
            raise SealError("Set both PDF_SEAL_CERT_FILE and PDF_SEAL_KEY_FILE")
        return Path(cert), Path(key)
    return _DEFAULT_DIR / "cert.pem", _DEFAULT_DIR / "key.pem"


def _ensure_material(cert_path: Path, key_path: Path) -> None:
    if cert_path.is_file() and key_path.is_file():
        return
    if cert_path.is_file() or key_path.is_file():
        raise SealError("Seal certificate and key must both exist")
    log.warning("Generating a self-signed demo seal certificate at %s", cert_path)
    _write_dev_material(cert_path, key_path)


def _write_dev_material(cert_path: Path, key_path: Path) -> None:
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name(
        [x509.NameAttribute(NameOID.COMMON_NAME, "segment-practice page seal")]
    )
    now = datetime.now(timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(minutes=5))
        .not_valid_after(now + timedelta(days=3650))
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .add_extension(
            x509.KeyUsage(
                digital_signature=True,
                content_commitment=True,
                key_encipherment=False,
                data_encipherment=False,
                key_agreement=False,
                key_cert_sign=False,
                crl_sign=False,
                encipher_only=False,
                decipher_only=False,
            ),
            critical=True,
        )
        .sign(key, hashes.SHA256())
    )
    cert_path.parent.mkdir(parents=True, exist_ok=True)
    key_path.parent.mkdir(parents=True, exist_ok=True)
    _write_secret(
        key_path,
        key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        ),
    )
    cert_path.write_bytes(cert.public_bytes(serialization.Encoding.PEM))


def _write_secret(path: Path, data: bytes) -> None:
    flags = os.O_WRONLY | os.O_CREAT | os.O_TRUNC
    fd = os.open(path, flags, 0o600)
    with os.fdopen(fd, "wb") as handle:
        handle.write(data)

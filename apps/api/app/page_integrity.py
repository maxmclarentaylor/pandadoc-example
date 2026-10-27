"""Canonical snapshot hashing for locked pages."""

from __future__ import annotations

import hashlib
import json
from typing import Any


def content_hash(title: str, chunks: list[dict[str, Any]]) -> str:
    """SHA-256 fingerprint of title + chunks. One character change → different hash."""
    payload = json.dumps(
        {"title": title, "chunks": chunks},
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()

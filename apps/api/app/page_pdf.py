"""Render a frozen page snapshot to PDF with WeasyPrint."""

from __future__ import annotations

import hashlib
import logging
from html import escape
from typing import Any

log = logging.getLogger(__name__)


def pdf_sha256(pdf: bytes) -> str:
    return hashlib.sha256(pdf).hexdigest()


def page_to_html(title: str, chunks: list[dict[str, Any]]) -> str:
    parts = [f"<h1>{escape(title.strip() or 'Untitled')}</h1>"]
    for chunk in chunks:
        parts.append(_chunk_html(chunk))
    body = "\n".join(parts)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
    @page {{ size: A4; margin: 2cm; }}
    body {{
      font-family: DejaVu Sans, Liberation Sans, sans-serif;
      font-size: 11pt;
      color: #1c1c1c;
      line-height: 1.45;
    }}
    h1 {{
      font-size: 18pt;
      margin: 0 0 1.2em;
    }}
    p {{
      margin: 0 0 0.9em;
      white-space: pre-wrap;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      margin: 0 0 1em;
    }}
    th, td {{
      border: 1px solid #d4d4d8;
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
    }}
    th {{
      background: #fafafa;
      font-weight: 600;
    }}
    img.media {{
      max-width: 100%;
      height: auto;
      margin: 0 0 1em;
    }}
    img.signature {{
      max-height: 72px;
      display: block;
      margin: 0.4em 0 1em;
      border-bottom: 1px solid #e4e4e7;
    }}
    .placeholder {{
      color: #a1a1aa;
      margin: 0 0 1em;
    }}
  </style>
</head>
<body>
{body}
</body>
</html>
"""


def _chunk_html(chunk: dict[str, Any]) -> str:
    kind = str(chunk.get("type") or "text")
    if kind == "text":
        text = str(chunk.get("text") or "")
        return f"<p>{escape(text) if text else '—'}</p>"
    if kind == "image":
        src = str(chunk.get("src") or "")
        alt = escape(str(chunk.get("alt") or "Image"))
        if src:
            return f'<img class="media" src="{escape(src, quote=True)}" alt="{alt}" />'
        return '<p class="placeholder">Image</p>'
    if kind == "video":
        url = str(chunk.get("url") or "")
        if url:
            return f'<p>Video: <a href="{escape(url, quote=True)}">{escape(url)}</a></p>'
        return '<p class="placeholder">Video</p>'
    if kind == "table":
        columns = chunk.get("columns") or []
        rows = chunk.get("rows") or []
        head = "".join(f"<th>{escape(str(column) or '—')}</th>" for column in columns)
        body_rows = []
        for row in rows:
            cells = row if isinstance(row, list) else []
            body_rows.append(
                "<tr>"
                + "".join(f"<td>{escape(str(cell) or '—')}</td>" for cell in cells)
                + "</tr>"
            )
        return f"<table><thead><tr>{head}</tr></thead><tbody>{''.join(body_rows)}</tbody></table>"
    if kind == "signature":
        data_url = str(chunk.get("dataUrl") or "")
        if data_url.startswith("data:image"):
            return f'<img class="signature" src="{escape(data_url, quote=True)}" alt="Signature" />'
        return '<p class="placeholder">Signature</p>'
    if kind == "date":
        value = str(chunk.get("value") or "")
        return f"<p>{escape(value) if value else 'Date'}</p>"
    return ""


def render_page_pdf(title: str, chunks: list[dict[str, Any]]) -> bytes:
    from weasyprint import HTML

    html = page_to_html(title, chunks)
    pdf = HTML(string=html).write_pdf()
    if not isinstance(pdf, (bytes, bytearray)):
        raise RuntimeError("WeasyPrint did not return PDF bytes")
    return bytes(pdf)

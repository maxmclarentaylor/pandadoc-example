"""Yjs page documents merge concurrent text edits. Needs pycrdt (Python 3.10+)."""

import pytest

pytest.importorskip("pycrdt")

from pycrdt import Array, Doc

from app.collab import encode_page, read_state


def test_page_state_round_trip():
    state = encode_page(
        "Notes",
        [
            {"id": "c1", "type": "text", "text": "Hello"},
            {
                "id": "t1",
                "type": "table",
                "columns": ["Item", "Price"],
                "rows": [["Widget", "5"]],
            },
        ],
    )
    title, chunks = read_state(state)
    assert title == "Notes"
    assert chunks[0]["text"] == "Hello"
    assert chunks[1]["rows"] == [["Widget", "5"]]


def test_concurrent_edits_both_remain():
    state = encode_page("Title", [{"id": "c1", "type": "text", "text": "Hello"}])
    left = Doc()
    right = Doc()
    left.apply_update(state)
    right.apply_update(state)

    left_text = left.get("chunks", type=Array)[0].get("text")
    right_text = right.get("chunks", type=Array)[0].get("text")
    left_text.insert(5, " left")
    right_text.insert(0, "Right ")

    merged = Doc()
    merged.apply_update(left.get_update())
    merged.apply_update(right.get_update())
    text = str(merged.get("chunks", type=Array)[0].get("text"))
    assert "left" in text
    assert "Right" in text

"""Opt-in Azure live-DB smoke tests (disabled by default).

Run only when you intentionally point at a disposable Azure test database:

  RUN_AZURE_DB_TESTS=1 TEST_DATABASE_URL='postgresql://...' pytest -m azure
"""

from __future__ import annotations

import os

import pytest

pytestmark = [
    pytest.mark.azure,
    pytest.mark.skipif(
        os.getenv("RUN_AZURE_DB_TESTS") != "1",
        reason="Set RUN_AZURE_DB_TESTS=1 and TEST_DATABASE_URL to a disposable Azure DB",
    ),
]


def test_azure_health_via_app(client):
    """Sanity: same app stack can talk to whatever DATABASE_URL was configured."""
    res = client.get("/health")
    assert res.status_code == 200

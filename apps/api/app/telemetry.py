"""Optional Application Insights (Azure Monitor OpenTelemetry).

Call setup_telemetry() before importing FastAPI so request instrumentation
attaches correctly. No-op when APPLICATIONINSIGHTS_CONNECTION_STRING is unset
(local uvicorn without Azure).
"""

from __future__ import annotations

import os


def setup_telemetry() -> None:
    connection_string = os.getenv("APPLICATIONINSIGHTS_CONNECTION_STRING")
    if not connection_string:
        return

    from azure.monitor.opentelemetry import configure_azure_monitor

    configure_azure_monitor(
        connection_string=connection_string,
        disable_offline_storage=True,
    )

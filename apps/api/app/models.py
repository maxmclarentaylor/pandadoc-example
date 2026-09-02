from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class TrackEvent(BaseModel):
    message_id: str = Field(..., min_length=1, description="Unique id for idempotent writes")
    event: str = Field(..., min_length=1, description="Event name, e.g. Page Viewed")
    anonymous_id: Optional[str] = None
    user_id: Optional[str] = None
    properties: dict[str, Any] = Field(default_factory=dict)
    timestamp: Optional[datetime] = Field(
        default=None,
        description="When the event happened; defaults to server receive time",
    )


class EventRecord(BaseModel):
    message_id: str
    anonymous_id: Optional[str]
    user_id: Optional[str]
    event: str
    properties: dict[str, Any]
    event_timestamp: datetime
    received_at: datetime

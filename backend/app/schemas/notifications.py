from datetime import datetime

from pydantic import BaseModel


class NotificationOut(BaseModel):
    id: int
    event_id: int
    title: str
    occurrence_start: datetime
    fire_at: datetime

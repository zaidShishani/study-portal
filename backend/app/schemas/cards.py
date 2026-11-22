from datetime import date, datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

# Markdown: whitespace is kept as typed.
Body = Annotated[str, Field(min_length=1, max_length=10_000)]


# Scheduling fields (stage, due_date, review_count, retired_at) are server-owned; extra keys are ignored.
class CardCreate(BaseModel):
    front: Body
    back: Body


class CardUpdate(BaseModel):
    front: Body | None = None
    back: Body | None = None


class CardOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    deck_id: int
    front: str
    back: str
    stage: int
    due_date: date | None
    review_count: int
    last_reviewed_at: datetime | None
    retired_at: datetime | None
    created_at: datetime
    updated_at: datetime

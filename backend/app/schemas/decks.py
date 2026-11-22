from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]


class DeckCreate(BaseModel):
    title: Title


class DeckUpdate(BaseModel):
    title: Title


class DeckOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    created_at: datetime
    updated_at: datetime
    # Not deck columns: the router fills these from card counts.
    card_count: int = 0
    due_count: int = 0

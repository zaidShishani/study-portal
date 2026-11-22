from datetime import date, datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt, StringConstraints, field_validator

from app.schemas.common import InputModel, NoNul

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200), NoNul]
# Markdown: whitespace is kept as typed.
Description = Annotated[str, Field(max_length=10_000), NoNul]
# Strict so JSON true isn't coerced to 1; bounded to Postgres integer.
CheckpointId = Annotated[StrictInt, Field(gt=0, le=2_147_483_647)]


def _not_null(v: object) -> object:
    if v is None:  # NOT NULL columns: omit the field instead of sending null
        raise ValueError("may not be null")
    return v


class RoadmapCreate(InputModel):
    title: Title
    description: Description | None = None


class RoadmapUpdate(InputModel):
    """Partial: only fields sent are changed; description can be cleared with null."""

    title: Title | None = None
    description: Description | None = None

    _title_not_null = field_validator("title")(_not_null)


class CheckpointCreate(InputModel):
    title: Title
    description: Description | None = None
    target_date: date | None = None


class CheckpointUpdate(InputModel):
    """Partial: only fields sent are changed; description/target_date can be cleared with null."""

    title: Title | None = None
    description: Description | None = None
    target_date: date | None = None
    done: StrictBool | None = None  # sets / clears done_at

    _not_null = field_validator("title", "done")(_not_null)


class CheckpointOrder(InputModel):
    # shortcut: caps reorder at 1000 checkpoints per roadmap; raise if roadmaps get that long.
    ids: list[CheckpointId] = Field(max_length=1000)


class CheckpointOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    roadmap_id: int
    position: int
    title: str
    description: str | None
    target_date: date | None
    done_at: datetime | None


class RoadmapOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    created_at: datetime
    updated_at: datetime
    # Not roadmap columns: the router fills these from checkpoint counts.
    done_count: int = 0
    total_count: int = 0


class RoadmapDetail(RoadmapOut):
    checkpoints: list[CheckpointOut] = []

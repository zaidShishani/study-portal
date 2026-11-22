from datetime import date, datetime
from typing import Annotated

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    HttpUrl,
    StringConstraints,
    UrlConstraints,
    field_validator,
)

from app.models.problems import Difficulty, LastResult, Pattern
from app.schemas.common import InputModel, NoNul

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255), NoNul]
# HttpUrl allows only http/https, so `javascript:` links are rejected.
Link = Annotated[HttpUrl, UrlConstraints(max_length=2048)]
# Markdown: whitespace is kept as typed.
Text = Annotated[str, Field(max_length=10_000), NoNul]
Minutes = Annotated[int, Field(ge=0, le=1440)]


# Scheduling and attempt fields (stage, due_date, review_count, retired_at, last_result,
# solved_date) are server-owned; sending them is a 422.
class ProblemCreate(InputModel):
    title: Title
    link: Link | None = None
    difficulty: Difficulty
    pattern: Pattern
    key_insight: Text | None = None
    notes: Text | None = None
    minutes: Minutes | None = None


class ProblemUpdate(InputModel):
    """Partial: only fields sent are changed; optional ones can be cleared with null."""

    title: Title | None = None
    link: Link | None = None
    difficulty: Difficulty | None = None
    pattern: Pattern | None = None
    key_insight: Text | None = None
    notes: Text | None = None
    minutes: Minutes | None = None

    @field_validator("title", "difficulty", "pattern")
    @classmethod
    def _not_null(cls, v: object) -> object:
        if v is None:  # NOT NULL columns: omit the field instead of sending null
            raise ValueError("may not be null")
        return v


# Only the outcome comes from the client; stage and today are always server-side.
class AttemptIn(InputModel):
    result: LastResult
    minutes: Minutes | None = None


class ProblemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    title: str
    link: str | None
    difficulty: Difficulty
    pattern: Pattern
    key_insight: str | None
    notes: str | None
    minutes: int | None
    last_result: LastResult | None
    solved_date: date | None
    review_count: int
    stage: int
    due_date: date | None
    retired_at: datetime | None
    created_at: datetime
    updated_at: datetime

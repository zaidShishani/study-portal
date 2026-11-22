from datetime import datetime
from typing import Annotated

from pydantic import (
    AfterValidator,
    AwareDatetime,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    StrictBool,
    StrictInt,
    StringConstraints,
)

from app.schemas.common import InputModel, NoNul
from app.services.rrule import MAX_YEAR, MIN_YEAR


def _require_str(v: object) -> object:
    if not isinstance(v, str):
        raise ValueError("must be an ISO 8601 string")  # no unix numbers
    return v


def _in_year_range(v: datetime) -> datetime:
    if not MIN_YEAR <= v.year <= MAX_YEAR:
        raise ValueError(f"year must be within {MIN_YEAR}-{MAX_YEAR}")
    return v


Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200), NoNul]
Description = Annotated[str, Field(max_length=10_000), NoNul]
# ISO strings with an offset only; naive times are a 422.
Time = Annotated[AwareDatetime, BeforeValidator(_require_str), AfterValidator(_in_year_range)]
Remind = Annotated[StrictInt, Field(ge=0, le=10_080)]  # up to one week


class EventCreate(InputModel):
    # rrule length and content are checked by app.services.rrule.validate (needs start_at).
    title: Title
    description: Description | None = None
    start_at: Time
    end_at: Time | None = None
    all_day: StrictBool = False
    rrule: str | None = None
    remind_minutes_before: Remind | None = None


class EventUpdate(InputModel):
    """Partial: only fields sent are changed; optional ones can be cleared with null."""

    title: Title | None = None
    description: Description | None = None
    start_at: Time | None = None
    end_at: Time | None = None
    all_day: StrictBool | None = None
    rrule: str | None = None
    remind_minutes_before: Remind | None = None


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    start_at: datetime
    end_at: datetime | None
    all_day: bool
    rrule: str | None
    remind_minutes_before: int | None
    created_at: datetime
    updated_at: datetime

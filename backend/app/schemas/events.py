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
from app.services.rrule import check_near_now


def _require_str(v: object) -> object:
    if not isinstance(v, str):
        raise ValueError("must be an ISO 8601 string")  # no unix numbers
    return v


def _near_now(v: datetime) -> datetime:
    check_near_now(v)  # bounds RRULE expansion cost
    return v


Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200), NoNul]
Description = Annotated[str, Field(max_length=10_000), NoNul]
# ISO strings with an offset only; naive times are a 422.
Time = Annotated[AwareDatetime, BeforeValidator(_require_str), AfterValidator(_near_now)]
# Content is checked by app.services.rrule.validate (it needs start_at).
Rule = Annotated[str, Field(max_length=500), NoNul]
Remind = Annotated[StrictInt, Field(ge=0, le=10_080)]  # up to one week


class EventCreate(InputModel):
    title: Title
    description: Description | None = None
    start_at: Time
    end_at: Time | None = None
    all_day: StrictBool = False
    rrule: Rule | None = None
    remind_minutes_before: Remind | None = None


class EventUpdate(InputModel):
    """Partial: only fields sent are changed; optional ones can be cleared with null."""

    title: Title | None = None
    description: Description | None = None
    start_at: Time | None = None
    end_at: Time | None = None
    all_day: StrictBool | None = None
    rrule: Rule | None = None
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

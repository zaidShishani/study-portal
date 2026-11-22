from zoneinfo import available_timezones

from pydantic import BaseModel, ConfigDict, Field, field_validator

# tzdata ships these non-IANA keys; they are not real user timezones
TIMEZONES = available_timezones() - {"localtime", "Factory"}


class MeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str | None
    timezone: str


class MeUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    timezone: str = Field(max_length=64)

    @field_validator("timezone")
    @classmethod
    def known_timezone(cls, v: str) -> str:
        if v not in TIMEZONES:
            raise ValueError("unknown timezone")
        return v

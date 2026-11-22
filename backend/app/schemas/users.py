from zoneinfo import available_timezones

from pydantic import BaseModel, ConfigDict, Field, field_validator

TIMEZONES = available_timezones()


class MeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str | None
    timezone: str


class MeUpdate(BaseModel):
    timezone: str = Field(max_length=64)

    @field_validator("timezone")
    @classmethod
    def known_timezone(cls, v: str) -> str:
        if v not in TIMEZONES:
            raise ValueError("unknown timezone")
        return v

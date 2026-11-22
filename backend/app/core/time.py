from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

from app.models.users import User


def today_for(user: User, now: datetime | None = None) -> date:
    """The calendar date in the user's timezone. `now` (tz-aware) exists for tests."""
    return (now or datetime.now(UTC)).astimezone(ZoneInfo(user.timezone)).date()

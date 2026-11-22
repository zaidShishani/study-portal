from datetime import UTC, date, datetime

from app.core.time import today_for
from app.models.users import User


def test_today_for_differs_across_timezones_near_midnight_utc():
    now = datetime(2026, 1, 15, 23, 30, tzinfo=UTC)
    assert today_for(User(timezone="UTC"), now) == date(2026, 1, 15)
    assert today_for(User(timezone="Pacific/Kiritimati"), now) == date(2026, 1, 16)  # UTC+14
    assert today_for(User(timezone="America/Los_Angeles"), now) == date(2026, 1, 15)  # UTC-8
    # just after midnight UTC, Los Angeles is still on the previous day
    after_midnight = datetime(2026, 1, 16, 0, 30, tzinfo=UTC)
    assert today_for(User(timezone="America/Los_Angeles"), after_midnight) == date(2026, 1, 15)

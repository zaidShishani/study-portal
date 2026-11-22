from datetime import UTC, datetime, timedelta, timezone

from zoneinfo import ZoneInfo

import pytest

from app.models.events import Event
from app.services import rrule
from app.services.rrule import occurrences, validate

START = datetime(2026, 1, 1, 9, tzinfo=UTC)  # a Thursday
NY = ZoneInfo("America/New_York")


def occ(e: Event, start: datetime, end: datetime, tz: ZoneInfo = ZoneInfo("UTC")) -> list[datetime]:
    return occurrences(e, start, end, tz)


def ev(rule: str | None = None, start: datetime = START, end: datetime | None = None) -> Event:
    return Event(title="e", start_at=start, end_at=end, rrule=rule)


def at(day: int, month: int = 1) -> datetime:
    return datetime(2026, month, day, 9, tzinfo=UTC)


def test_daily():
    assert occ(ev("FREQ=DAILY"), START, at(4)) == [at(1), at(2), at(3)]


def test_rrule_prefix_and_lowercase_accepted():
    assert occ(ev("RRULE:freq=daily;count=2"), START, at(10)) == [at(1), at(2)]


def test_weekly_byday():
    got = occ(ev("FREQ=WEEKLY;BYDAY=MO,WE"), START, at(15))
    assert got == [at(5), at(7), at(12), at(14)]


def test_monthly():
    got = occ(ev("FREQ=MONTHLY"), START, datetime(2026, 4, 2, tzinfo=UTC))
    assert got == [at(1, 1), at(1, 2), at(1, 3), at(1, 4)]


def test_count():
    assert occ(ev("FREQ=DAILY;COUNT=3"), START, at(1, 3)) == [at(1), at(2), at(3)]


def test_until():
    assert occ(ev("FREQ=DAILY;UNTIL=20260103T090000Z"), START, at(1, 3)) == [at(1), at(2), at(3)]


def test_window_clipping():
    # Window starts mid-series and end is exclusive.
    assert occ(ev("FREQ=DAILY"), at(10), at(13)) == [at(10), at(11), at(12)]
    assert occ(ev("FREQ=DAILY"), datetime(2025, 1, 1, tzinfo=UTC), START) == []


def test_multi_hour_occurrence_overlapping_window_start_is_included():
    e = ev("FREQ=DAILY", end=START + timedelta(hours=2))
    assert occ(e, at(2) + timedelta(hours=1), at(3)) == [at(2)]


def test_non_recurring():
    e = ev(end=START + timedelta(hours=1))
    assert occ(e, START - timedelta(days=1), START) == []
    assert occ(e, START + timedelta(minutes=30), at(2)) == [START]  # overlaps
    assert occ(e, START + timedelta(hours=2), at(2)) == []
    assert occ(ev(), START, at(2)) == [START]


def test_other_offsets_compare_correctly():
    plus3 = timezone(timedelta(hours=3))
    assert occ(ev("FREQ=DAILY"), datetime(2026, 1, 2, 12, tzinfo=plus3), at(3)) == [at(2)]


def test_recurrence_keeps_wall_clock_time_across_dst():
    # 09:00 New York, weekly on Mondays; DST ends 2026-11-01.
    e = ev("FREQ=WEEKLY", start=datetime(2026, 10, 26, 13, tzinfo=UTC))
    got = occ(e, datetime(2026, 10, 26, tzinfo=UTC), datetime(2026, 11, 3, tzinfo=UTC), NY)
    assert got == [datetime(2026, 10, 26, 13, tzinfo=UTC), datetime(2026, 11, 2, 14, tzinfo=UTC)]
    assert all(o.tzinfo is UTC for o in got)


def test_until_in_utc_with_zoneinfo_dtstart():
    e = ev("FREQ=DAILY;UNTIL=20260102T090000Z")
    assert occ(e, START, at(10), NY) == [at(1), at(2)]


def test_window_max_366_days():
    assert len(occ(ev("FREQ=DAILY"), START, START + timedelta(days=366))) == 366
    with pytest.raises(ValueError):
        occ(ev("FREQ=DAILY"), START, START + timedelta(days=367))
    with pytest.raises(ValueError):
        occ(ev("FREQ=DAILY"), START, START)  # empty
    with pytest.raises(ValueError):
        occ(ev("FREQ=DAILY"), at(2), START)  # reversed


def test_window_must_be_aware_and_in_year_range():
    with pytest.raises(ValueError):
        occ(ev(), datetime(2026, 1, 1), datetime(2026, 1, 2))
    with pytest.raises(ValueError):
        occ(ev(), datetime(2200, 12, 31, tzinfo=UTC), datetime(2201, 1, 2, tzinfo=UTC))


def test_occurrence_cap(monkeypatch: pytest.MonkeyPatch):
    # Allowed rules give at most one occurrence per day, so a 366-day window can't reach 1000;
    # lower the cap to prove an infinite rule is cut off by it.
    monkeypatch.setattr(rrule, "MAX_OCCURRENCES", 50)
    assert len(occ(ev("FREQ=DAILY"), START, START + timedelta(days=366))) == 50


@pytest.mark.parametrize(
    "rule",
    [
        "",
        "garbage",
        "FREQ=DAILY;BOGUS=1",
        "FREQ=WEEKLY;BYDAY=XX",
        "FREQ=DAILY;UNTIL=20260105",  # naive UNTIL with aware dtstart
        "FREQ=SECONDLY",
        "FREQ=MINUTELY",
        "FREQ=HOURLY",
        "FREQ=DAILY;BYHOUR=9,10",
        "FREQ=DAILY;BYMINUTE=0,30",
        "FREQ=WEEKLY;BYSECOND=1",
        "FREQ=DAILY;INTERVAL=0",
        "FREQ=DAILY;DTSTART=20200101T000000Z",
        "DTSTART:20200101T000000Z",
        "EXRULE:FREQ=DAILY",
        "RDATE:20260101T000000Z",
        "RRULE:FREQ=DAILY\nEXRULE:FREQ=WEEKLY",
        "RRULE:FREQ=DAILY\r\nRRULE:FREQ=WEEKLY",
        # rrulestr splits on any whitespace; a DTSTART would override start_at.
        "DTSTART:20200101T000000Z RRULE:FREQ=DAILY",
        "DTSTART:20200101T000000Z\tRRULE:FREQ=DAILY",
        "DTSTART:20200101T000000 RRULE:FREQ=DAILY",  # naive
        "DTSTART:20200101T000000\tRRULE:FREQ=DAILY",
        "FREQ=DAILY; COUNT=2",
        "FREQ=DAILY;COUNT=0",
        "FREQ=DAILY;UNTIL=20251231T000000Z",  # before START
        "FREQ=DAILY;" + "BYMONTHDAY=1;" * 50,  # > 500 chars
    ],
)
def test_invalid_rules_rejected(rule: str):
    with pytest.raises(ValueError):
        validate(rule, START)


def test_length_limit_boundary():
    rule = "FREQ=DAILY;" + "WKST=MO;" * 60 + "COUNT=1"
    assert len(rule) == 498
    validate(rule, START)


def test_naive_dtstart_rejected():
    with pytest.raises(ValueError):
        validate("FREQ=DAILY", datetime(2026, 1, 1))

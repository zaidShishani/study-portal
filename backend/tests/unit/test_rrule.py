import time
from datetime import UTC, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest

from app.models.events import Event
from app.services import rrule
from app.services.rrule import occurrences, validate

# shortcut: fixed dates must stay within 10 years of today (check_near_now); move them before 2035.
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


def test_window_must_be_aware_and_within_10_years_of_now():
    with pytest.raises(ValueError):
        occ(ev(), datetime(2026, 1, 1), datetime(2026, 1, 2))
    now = datetime.now(UTC)
    for start in (now + timedelta(days=3654), now - timedelta(days=3660)):
        with pytest.raises(ValueError):
            occ(ev(), start, start + timedelta(days=2))
    occ(ev(), now + timedelta(days=3640), now + timedelta(days=3650))


def test_check_near_now():
    now = datetime.now(UTC)
    rrule.check_near_now(now - timedelta(days=3650))
    rrule.check_near_now(now + timedelta(days=3650))
    for dt in (now - timedelta(days=3654), now + timedelta(days=3654)):
        with pytest.raises(ValueError):
            rrule.check_near_now(dt)


def test_occurrence_cap(monkeypatch: pytest.MonkeyPatch):
    # Allowed rules start at most once per day and windows and durations are <= 366 days,
    # so at most ~733 occurrences overlap; lower the cap to prove an infinite rule is cut off by it.
    monkeypatch.setattr(rrule, "MAX_OCCURRENCES", 50)
    assert len(occ(ev("FREQ=DAILY"), START, START + timedelta(days=366))) == 50


def naive_occ(e: Event, start: datetime, end: datetime, tz: ZoneInfo) -> list[datetime]:
    """Reference expansion straight from dtstart, without fast-forwarding."""
    first = start - ((e.end_at or e.start_at) - e.start_at)
    rule = validate(e.rrule, e.start_at.astimezone(tz))
    return [s.astimezone(UTC) for s in rule.between(first, end, inc=True) if s < end]


@pytest.mark.parametrize(
    "rule",
    ["FREQ=DAILY", "FREQ=DAILY;INTERVAL=3", "FREQ=DAILY;INTERVAL=366", "FREQ=WEEKLY",
     "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,FR", "FREQ=WEEKLY;INTERVAL=5;BYDAY=SU,TU;WKST=SU",
     "FREQ=WEEKLY;INTERVAL=7;BYDAY=TU", "FREQ=DAILY;UNTIL=20300101T000000Z"],
)  # fmt: skip
@pytest.mark.parametrize("hours", [0, 30])  # event duration
@pytest.mark.parametrize(
    "window_start",
    [datetime(2026, 1, 1, 9, tzinfo=UTC), datetime(2026, 3, 8, 6, 59, tzinfo=UTC),
     datetime(2029, 10, 31, tzinfo=UTC), datetime(2031, 6, 15, 12, 30, tzinfo=UTC)],
)  # fmt: skip
def test_fast_forward_matches_naive_expansion(rule: str, hours: int, window_start: datetime):
    e = ev(rule, start=datetime(2018, 3, 11, 13, 30, tzinfo=UTC), end=datetime(2018, 3, 11, 13, 30, tzinfo=UTC) + timedelta(hours=hours))
    end = window_start + timedelta(days=40)
    assert occ(e, window_start, end, NY) == naive_occ(e, window_start, end, NY)


def test_old_daily_events_expand_fast():
    now = datetime.now(UTC)
    now = now.replace(microsecond=0)  # stored starts have none (schema truncates)
    events = [ev("FREQ=DAILY", start=now - timedelta(days=3650, minutes=i)) for i in range(500)]
    began = time.perf_counter()
    for e in events:
        assert len(occ(e, now, now + timedelta(days=31), NY)) == 31
    assert time.perf_counter() - began < 0.5


def test_start_in_repeated_fall_back_hour_is_kept():
    # 2026-11-01 01:30 EST (the second 01:30 in New York) = 06:30Z.
    start = datetime(2026, 11, 1, 6, 30, tzinfo=UTC)
    assert start.astimezone(NY).fold == 1
    got = occ(ev("FREQ=DAILY", start=start), datetime(2026, 11, 1, tzinfo=UTC), datetime(2026, 11, 3, tzinfo=UTC), NY)
    assert got == [start, datetime(2026, 11, 2, 6, 30, tzinfo=UTC)]


def test_start_not_matching_byday_is_not_added():
    # START is a Thursday; dateutil skips a dtstart that BYDAY doesn't match, and so do we.
    assert at(1) not in occ(ev("FREQ=WEEKLY;BYDAY=MO"), START, at(10), NY)


@pytest.mark.parametrize(
    "rule",
    [
        "",
        "garbage",
        "FREQ=DAILY;BOGUS=1",
        "FREQ=DAILY;;",
        "FREQ=WEEKLY;BYDAY=XX",
        "FREQ=DAILY;UNTIL=20260105",  # naive UNTIL with aware dtstart
        "FREQ=DAILY;UNTIL=20260105T000000",
        "FREQ=SECONDLY",
        "FREQ=MINUTELY",
        "FREQ=HOURLY",
        "INTERVAL=2",  # no FREQ
        "FREQ=DAILY;BYHOUR=9,10",
        "FREQ=DAILY;BYMINUTE=0,30",
        "FREQ=WEEKLY;BYSECOND=1",
        "FREQ=DAILY;INTERVAL=0",
        "FREQ=DAILY;INTERVAL=367",
        "FREQ=DAILY;INTERVAL=-1",
        "FREQ=DAILY;COUNT=0",
        "FREQ=DAILY;COUNT=1001",
        "FREQ=DAILY;UNTIL=20251231T000000Z",  # before START
        "FREQ=DAILY;COUNT=2;COUNT=3",  # duplicate key
        "FREQ=DAILY;FREQ=WEEKLY",
        "FREQ=DAILY;COUNT=2;UNTIL=20270101T000000Z",
        "FREQ=DAILY;DTSTART=20200101T000000Z",
        "DTSTART:20200101T000000Z",
        "DTSTART;TZID=/etc/passwd:20200101T000000",
        "EXRULE:FREQ=DAILY",
        "RDATE:20260101T000000Z",
        "rrule:FREQ=DAILY",
        "RRULE:FREQ=DAILY:X",
        "RRULE:FREQ=DAILY\nEXRULE:FREQ=WEEKLY",
        "RRULE:FREQ=DAILY\r\nRRULE:FREQ=WEEKLY",
        # rrulestr splits on any whitespace; a DTSTART would override start_at.
        "DTSTART:20200101T000000Z RRULE:FREQ=DAILY",
        "DTSTART:20200101T000000Z\tRRULE:FREQ=DAILY",
        "DTSTART:20200101T000000Z\vRRULE:FREQ=DAILY",
        "DTSTART:20200101T000000Z　RRULE:FREQ=DAILY",
        "DTSTART:20200101T000000Z\x1cRRULE:FREQ=DAILY",
        "DTSTART:20200101T000000 RRULE:FREQ=DAILY",  # naive
        "FREQ=DAILY; COUNT=2",
        # Rules that never (or rarely) match would scan to year 9999.
        "FREQ=DAILY;BYSETPOS=-366",
        "FREQ=DAILY;BYMONTH=2;BYMONTHDAY=30",
        "FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=30",
        "FREQ=MONTHLY;BYMONTHDAY=31",
        "FREQ=YEARLY;BYYEARDAY=366",
        "FREQ=YEARLY;BYWEEKNO=53",
        "FREQ=YEARLY;BYEASTER=0",
        "FREQ=DAILY;BYDAY=TU",  # BYDAY only with WEEKLY
        "FREQ=MONTHLY;BYDAY=-1FR",
        "FREQ=WEEKLY;BYDAY=1MO",
        "FREQ=WEEKLY;BYDAY=+1MO",
        "FREQ=DAILY;" + "WKST=MO;" * 70,  # > 500 chars
    ],
)
def test_invalid_rules_rejected(rule: str):
    with pytest.raises(ValueError):
        validate(rule, START)


def test_length_limit_boundary():
    rule = "FREQ=WEEKLY;BYDAY=" + "MO," * 159 + "TU"
    assert len(rule) == 497
    validate(rule, START)


ACCEPTED = [
    "FREQ=DAILY",
    "FREQ=DAILY;INTERVAL=366",
    "FREQ=WEEKLY;INTERVAL=7;BYDAY=TU",  # START is a Thursday
    "FREQ=WEEKLY;INTERVAL=366;BYDAY=MO,SU;WKST=SU",
    "FREQ=MONTHLY;INTERVAL=366",
    "FREQ=YEARLY;INTERVAL=366",
    "FREQ=DAILY;COUNT=1000",
    "FREQ=DAILY;UNTIL=22001231T000000Z",
]


@pytest.mark.parametrize("rule", ACCEPTED)
@pytest.mark.parametrize("dtstart", [START, datetime(2026, 1, 31, 9, tzinfo=UTC), datetime(2024, 2, 29, 9, tzinfo=UTC)])
def test_accepted_rules_expand_fast(rule: str, dtstart: datetime):
    e = ev(rule, start=dtstart)
    began = time.perf_counter()
    occ(e, dtstart, dtstart + timedelta(days=366), NY)
    assert time.perf_counter() - began < 0.05


def test_naive_dtstart_rejected():
    with pytest.raises(ValueError):
        validate("FREQ=DAILY", datetime(2026, 1, 1))

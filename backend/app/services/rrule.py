from datetime import datetime, timedelta
from itertools import islice, takewhile

from dateutil.rrule import HOURLY, MINUTELY, SECONDLY, rrule, rrulestr

from app.models.events import Event

MAX_LENGTH = 500
MAX_WINDOW = timedelta(days=366)
MAX_OCCURRENCES = 1000
# Iteration starts at dtstart, so its cost grows with the distance to the window; bound both.
MIN_YEAR, MAX_YEAR = 1900, 2200


def validate(rule: str, dtstart: datetime) -> rrule:
    """Parse one RRULE; raise ValueError if it is invalid or could expand unboundedly."""
    if dtstart.tzinfo is None:
        raise ValueError("dtstart must be timezone-aware")
    if len(rule) > MAX_LENGTH:
        raise ValueError(f"RRULE must be at most {MAX_LENGTH} characters")
    if "\n" in rule or "\r" in rule:
        raise ValueError("only a single RRULE is allowed")
    try:
        parsed = rrulestr(rule, dtstart=dtstart)
    except Exception as e:  # the parser raises ValueError, IndexError, ... on bad input
        raise ValueError("invalid RRULE") from e
    if not isinstance(parsed, rrule):  # EXRULE/RDATE/EXDATE parse to an rruleset
        raise ValueError("only a single RRULE is allowed")
    # dateutil has no public accessors for these.
    if parsed._freq in (SECONDLY, MINUTELY, HOURLY):
        raise ValueError("FREQ must be DAILY, WEEKLY, MONTHLY or YEARLY")
    if parsed._original_rule.keys() & {"byhour", "byminute", "bysecond"}:
        # They repeat an occurrence within a day, like the banned FREQs.
        raise ValueError("BYHOUR, BYMINUTE and BYSECOND are not allowed")
    if parsed._interval < 1:
        raise ValueError("INTERVAL must be at least 1")  # INTERVAL=0 makes iteration loop forever
    return parsed


def occurrences(event: Event, start: datetime, end: datetime) -> list[datetime]:
    """Start times of the event's occurrences overlapping [start, end), at most MAX_OCCURRENCES."""
    if start.tzinfo is None or end.tzinfo is None:
        raise ValueError("window must be timezone-aware")
    if not timedelta(0) < end - start <= MAX_WINDOW:
        raise ValueError(f"window must be positive and at most {MAX_WINDOW.days} days")
    if start.year < MIN_YEAR or end.year > MAX_YEAR:
        raise ValueError(f"window must be within {MIN_YEAR}-{MAX_YEAR}")
    # An occurrence overlaps if it starts before `end` and ends at or after `start`.
    first = start - ((event.end_at or event.start_at) - event.start_at)
    # shortcut: expands in the stored offset (UTC), so local wall-clock time shifts across DST;
    # expand in the user's timezone if the calendar needs it.
    if event.rrule is None:
        starts = iter([event.start_at])
    else:
        starts = validate(event.rrule, event.start_at).xafter(first, inc=True)
    in_window = takewhile(lambda s: s < end, (s for s in starts if s >= first))
    return list(islice(in_window, MAX_OCCURRENCES))

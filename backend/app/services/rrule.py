import re
from datetime import UTC, datetime, timedelta
from itertools import islice, takewhile
from zoneinfo import ZoneInfo

from dateutil.rrule import rrule, rrulestr

from app.models.events import Event

MAX_LENGTH = 500
MAX_WINDOW = timedelta(days=366)
MAX_OCCURRENCES = 1000
# Iteration starts at dtstart, so its cost grows with the distance to the window; bound both.
MIN_YEAR, MAX_YEAR = 1900, 2200


# No whitespace or extra ":" (rrulestr would read DTSTART/TZID lines), only RRULE characters.
_CHARS = re.compile(r"(RRULE:)?[A-Za-z0-9=;,+\-]+")
# Only what the calendar UI emits. Every rule in this subset occurs within a few periods,
# so expansion never scans for a match that doesn't exist (e.g. BYMONTHDAY=30 in February).
_FREQS = {"DAILY", "WEEKLY", "MONTHLY", "YEARLY"}
_KEYS = {"FREQ", "INTERVAL", "COUNT", "UNTIL", "BYDAY", "WKST"}
_DAYS = {"MO", "TU", "WE", "TH", "FR", "SA", "SU"}


def _in_range(value: str, high: int) -> bool:
    return value.isdigit() and 1 <= int(value) <= high


def validate(rule: str, dtstart: datetime) -> rrule:
    """Parse one RRULE from the allowed subset; raise ValueError otherwise."""
    if dtstart.tzinfo is None:
        raise ValueError("dtstart must be timezone-aware")
    if len(rule) > MAX_LENGTH:
        raise ValueError(f"RRULE must be at most {MAX_LENGTH} characters")
    if not _CHARS.fullmatch(rule):
        raise ValueError("RRULE contains characters that are not allowed")
    parts = [p.partition("=") for p in rule.upper().removeprefix("RRULE:").split(";")]
    params = {key: value for key, _, value in parts}
    if len(params) != len(parts):
        raise ValueError("duplicate RRULE parts are not allowed")
    if not params.keys() <= _KEYS:
        raise ValueError("only FREQ, INTERVAL, COUNT, UNTIL, BYDAY and WKST are allowed")
    if params.get("FREQ") not in _FREQS:
        raise ValueError("FREQ must be DAILY, WEEKLY, MONTHLY or YEARLY")
    if "BYDAY" in params and (params["FREQ"] != "WEEKLY" or not set(params["BYDAY"].split(",")) <= _DAYS):
        raise ValueError("BYDAY is only allowed with FREQ=WEEKLY, as plain days MO..SU")
    if "INTERVAL" in params and not _in_range(params["INTERVAL"], 366):
        raise ValueError("INTERVAL must be 1-366")
    if "COUNT" in params and not _in_range(params["COUNT"], 1000):
        raise ValueError("COUNT must be 1-1000")
    if "UNTIL" in params and not params["UNTIL"].endswith("Z"):
        raise ValueError("UNTIL must be in UTC (ending in Z)")
    try:
        parsed = rrulestr(rule, dtstart=dtstart)
    except Exception as e:  # the parser raises ValueError, IndexError, ... on bad input
        raise ValueError("invalid RRULE") from e
    # Backstop: the rule must not replace start_at. dateutil has no public accessors for these.
    if not isinstance(parsed, rrule) or parsed._dtstart != dtstart:
        raise ValueError("invalid RRULE")
    if parsed._until is not None and parsed._until < dtstart:
        raise ValueError("UNTIL must not be before start_at")
    return parsed


def occurrences(event: Event, start: datetime, end: datetime, tz: ZoneInfo) -> list[datetime]:
    """UTC start times of the event's occurrences overlapping [start, end), at most MAX_OCCURRENCES.

    Recurrence is expanded in `tz` (the user's timezone), so wall-clock time stays fixed across DST.
    """
    if start.tzinfo is None or end.tzinfo is None:
        raise ValueError("window must be timezone-aware")
    if not timedelta(0) < end - start <= MAX_WINDOW:
        raise ValueError(f"window must be positive and at most {MAX_WINDOW.days} days")
    if start.year < MIN_YEAR or end.year > MAX_YEAR:
        raise ValueError(f"window must be within {MIN_YEAR}-{MAX_YEAR}")
    # An occurrence overlaps if it starts before `end` and ends at or after `start`.
    first = start - ((event.end_at or event.start_at) - event.start_at)
    if event.rrule is None:
        starts = iter([event.start_at])
    else:
        starts = validate(event.rrule, event.start_at.astimezone(tz)).xafter(first, inc=True)
    in_window = takewhile(lambda s: s < end, (s for s in starts if s >= first))
    return [s.astimezone(UTC) for s in islice(in_window, MAX_OCCURRENCES)]

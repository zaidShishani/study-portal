import logging
from datetime import date, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import func, literal, or_, select
from sqlalchemy.orm import Session

from app.core.time import today_for
from app.models.decks import Card, Deck
from app.models.events import Event
from app.models.problems import Problem
from app.models.roadmaps import Checkpoint, Roadmap
from app.models.users import User
from app.services import rrule

log = logging.getLogger(__name__)
MAX_ITEMS = 1000  # per derived list, like rrule.MAX_OCCURRENCES for events


def events_between(
    db: Session, user: User, start: datetime, end: datetime, tz: ZoneInfo
) -> tuple[list[dict[str, Any]], bool, list[int]]:
    """Occurrences overlapping [start, end) sorted by start, capped at MAX_OCCURRENCES.

    Returns (events, truncated, invalid_event_ids); events whose stored rule fails validation are skipped.
    """
    events: list[dict[str, Any]] = []
    invalid_event_ids: list[int] = []
    truncated = False
    rows = db.scalars(
        select(Event).where(
            Event.user_id == user.id,
            # One-off events are filtered here; recurring ones by expansion.
            or_(
                Event.rrule.is_not(None),
                (Event.start_at < end) & (func.coalesce(Event.end_at, Event.start_at) >= start),
            ),
        )
    )
    for event in rows:
        duration = event.end_at - event.start_at if event.end_at else None
        try:
            starts = rrule.occurrences(event, start, end, tz)
        except ValueError:
            # A stored rule that no longer validates must not break the whole calendar.
            log.warning("events: skipping event %s with invalid rrule", event.id)
            invalid_event_ids.append(event.id)
            continue
        truncated |= len(starts) == rrule.MAX_OCCURRENCES
        events += [
            {
                "event_id": event.id,
                "title": event.title,
                "start": s,
                "end": s + duration if duration is not None else None,
                "all_day": event.all_day,
            }
            for s in starts
            if not (duration and s + duration <= start)  # ends exactly at the window start
        ]
    events.sort(key=lambda e: (e["start"], e["event_id"]))
    if len(events) > rrule.MAX_OCCURRENCES:  # bound the whole response, not just each event
        events, truncated = events[: rrule.MAX_OCCURRENCES], True
    return events, truncated, invalid_event_ids


def calendar(db: Session, user: User, first: date, last: date) -> dict[str, Any]:
    """Everything on the user's calendar for the inclusive local dates [first, last].

    Raises ValueError if the window is not within 10 years of now.
    """
    tz = ZoneInfo(user.timezone)
    start = datetime.combine(first, time(), tz)
    end = datetime.combine(last + timedelta(days=1), time(), tz)
    # Window errors raise here, so the per-event handler below only sees bad stored events.
    rrule.check_near_now(start)
    rrule.check_near_now(end)

    events, truncated, invalid_event_ids = events_between(db, user, start, end, tz)

    # Overdue items are due today: fold them onto today (dropped when today is outside the window).
    today = literal(today_for(user))
    # Subquery so GROUP BY sees one expression (two bound `today` params would differ).
    card_days = (
        select(func.greatest(Card.due_date, today).label("day"))
        .join(Deck, Card.deck_id == Deck.id)
        .where(Deck.user_id == user.id, Card.retired_at.is_(None))
        .subquery()
    )
    card_due = db.execute(
        select(card_days.c.day, func.count())
        .where(card_days.c.day.between(first, last))
        .group_by(card_days.c.day)
        .order_by(card_days.c.day)
    )  # at most 366 rows: one per day

    problem_day = func.greatest(Problem.due_date, today)
    problems = db.execute(
        select(Problem.id, Problem.title, problem_day)
        .where(Problem.user_id == user.id, Problem.retired_at.is_(None), problem_day.between(first, last))
        .order_by(problem_day, Problem.id)
        .limit(MAX_ITEMS + 1)
    ).all()

    checkpoints = db.execute(
        select(Checkpoint.id, Checkpoint.roadmap_id, Checkpoint.title, Checkpoint.target_date)
        .join(Roadmap, Checkpoint.roadmap_id == Roadmap.id)
        .where(
            Roadmap.user_id == user.id,
            Checkpoint.done_at.is_(None),
            Checkpoint.target_date.between(first, last),
        )
        .order_by(Checkpoint.target_date, Checkpoint.id)
        .limit(MAX_ITEMS + 1)
    ).all()
    truncated |= len(problems) > MAX_ITEMS or len(checkpoints) > MAX_ITEMS

    result: dict[str, Any] = {
        "events": events,
        "card_due": [{"date": d, "count": n} for d, n in card_due],
        "problems_due": [{"id": i, "title": t, "date": d} for i, t, d in problems[:MAX_ITEMS]],
        "checkpoints": [
            {"id": i, "roadmap_id": r, "title": t, "date": d} for i, r, t, d in checkpoints[:MAX_ITEMS]
        ],
        "truncated": truncated,
    }
    if invalid_event_ids:
        result["invalid_event_ids"] = invalid_event_ids
    return result

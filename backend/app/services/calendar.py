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


def calendar(db: Session, user: User, first: date, last: date) -> dict[str, Any]:
    """Everything on the user's calendar for the inclusive local dates [first, last].

    Raises ValueError for a window the rrule service rejects (e.g. longer than a year).
    """
    tz = ZoneInfo(user.timezone)
    start = datetime.combine(first, time(), tz)
    end = datetime.combine(last + timedelta(days=1), time(), tz)

    events: list[dict[str, Any]] = []
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
        starts = rrule.occurrences(event, start, end)
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
        ]
    events.sort(key=lambda e: (e["start"], e["event_id"]))
    if len(events) > rrule.MAX_OCCURRENCES:  # bound the whole response, not just each event
        events, truncated = events[: rrule.MAX_OCCURRENCES], True

    # Overdue items are due today: fold them onto today (dropped when today is outside the window).
    today = literal(today_for(user))
    # Subquery so GROUP BY sees one expression (two bound `today` params would differ).
    card_days = (
        select(func.greatest(Card.due_date, today).label("day"))
        .join(Deck, Card.deck_id == Deck.id)
        .where(Deck.user_id == user.id, Card.retired_at.is_(None), Card.due_date <= last)
        .subquery()
    )
    card_due = db.execute(
        select(card_days.c.day, func.count())
        .where(card_days.c.day >= first)
        .group_by(card_days.c.day)
        .order_by(card_days.c.day)
    )

    problem_day = func.greatest(Problem.due_date, today)
    problems = db.execute(
        select(Problem.id, Problem.title, problem_day)
        .where(
            Problem.user_id == user.id,
            Problem.retired_at.is_(None),
            Problem.due_date <= last,
            problem_day >= first,
        )
        .order_by(problem_day, Problem.id)
    )

    checkpoints = db.execute(
        select(Checkpoint.id, Checkpoint.roadmap_id, Checkpoint.title, Checkpoint.target_date)
        .join(Roadmap, Checkpoint.roadmap_id == Roadmap.id)
        .where(
            Roadmap.user_id == user.id,
            Checkpoint.done_at.is_(None),
            Checkpoint.target_date.between(first, last),
        )
        .order_by(Checkpoint.target_date, Checkpoint.id)
    )

    result: dict[str, Any] = {
        "events": events,
        "card_due": [{"date": d, "count": n} for d, n in card_due],
        "problems_due": [{"id": i, "title": t, "date": d} for i, t, d in problems],
        "checkpoints": [{"id": i, "roadmap_id": r, "title": t, "date": d} for i, r, t, d in checkpoints],
    }
    if truncated:
        result["truncated"] = True
    return result

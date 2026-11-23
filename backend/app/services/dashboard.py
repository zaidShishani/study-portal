from datetime import datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.time import today_for
from app.models.decks import Card, Deck
from app.models.problems import Problem
from app.models.roadmaps import Checkpoint, Roadmap
from app.models.users import User
from app.services.calendar import events_between

# shortcut: lists are capped (events at 100, the rest at 200) with no paging; add paging if a user outgrows them.
MAX_ITEMS = 200
MAX_EVENTS = 100


def today(db: Session, user: User) -> dict[str, Any]:
    """The home page: due cards per deck, due problems, today's events and roadmap progress."""
    day = today_for(user)

    due_count = func.count(Card.id)
    decks = db.execute(
        # The window sum is over all groups, so the total stays exact when the deck list is capped.
        select(Deck.id, Deck.title, due_count, func.sum(due_count).over())
        .join(Card, Card.deck_id == Deck.id)
        .where(Deck.user_id == user.id, Card.retired_at.is_(None), Card.due_date <= day)
        .group_by(Deck.id)
        .order_by(due_count.desc(), Deck.id)
        .limit(MAX_ITEMS)
    ).all()

    problems = db.execute(
        select(Problem.id, Problem.title, Problem.difficulty, Problem.due_date)
        .where(Problem.user_id == user.id, Problem.retired_at.is_(None), Problem.due_date <= day)
        .order_by(Problem.due_date, Problem.id)
        .limit(MAX_ITEMS)
    ).all()

    tz = ZoneInfo(user.timezone)
    start = datetime.combine(day, time(), tz)
    events, _, _ = events_between(db, user, start, datetime.combine(day + timedelta(days=1), time(), tz), tz)

    roadmaps = db.execute(
        select(Roadmap.id, Roadmap.title, func.count(Checkpoint.done_at), func.count(Checkpoint.id))
        .outerjoin(Checkpoint, Checkpoint.roadmap_id == Roadmap.id)
        .where(Roadmap.user_id == user.id)
        .group_by(Roadmap.id)
        .order_by(Roadmap.id)
        .limit(MAX_ITEMS)
    ).all()

    return {
        "date": day,
        "decks": [{"id": i, "title": t, "due_count": n} for i, t, n, _ in decks],
        "due_card_total": int(decks[0][3]) if decks else 0,  # SUM() OVER is numeric
        "problems_due": [{"id": i, "title": t, "difficulty": d, "due_date": dd} for i, t, d, dd in problems],
        "events_today": events[:MAX_EVENTS],
        "roadmaps": [{"id": i, "title": t, "done": d, "total": n} for i, t, d, n in roadmaps],
    }

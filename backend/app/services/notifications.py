import logging
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models.events import Event, Notification
from app.models.users import User
from app.services import rrule

log = logging.getLogger(__name__)
LOOKBACK = timedelta(days=7)  # older reminders are not caught up


def sync(db: Session, user: User, now: datetime) -> None:
    """Insert the user's reminders with fire_at in [now - 7 days, now]; existing rows are left as they are."""
    tz = ZoneInfo(user.timezone)
    rows = []
    events = db.scalars(
        # Same order in every sync, so concurrent syncs don't deadlock on the unique index.
        select(Event)
        .where(Event.user_id == user.id, Event.remind_minutes_before.is_not(None))
        .order_by(Event.id)
    )
    for event in events:
        remind = timedelta(minutes=event.remind_minutes_before)
        first, last = now - LOOKBACK + remind, now + remind  # occurrence starts that fire in range
        try:
            # +1 µs makes the half-open window include `last`; length is 7 days, far under the 366 cap.
            starts = rrule.occurrences(event, first, last + timedelta(microseconds=1), tz)
        except ValueError:
            log.warning("notifications: skipping event %s with invalid rrule", event.id)
            continue
        # occurrences() also returns ones that started earlier but still overlap: filter on start.
        rows += [
            {"user_id": user.id, "event_id": event.id, "occurrence_start": s, "fire_at": s - remind}
            for s in starts
            if s >= first
        ]
    if rows:
        db.execute(
            insert(Notification).values(rows).on_conflict_do_nothing(index_elements=["event_id", "occurrence_start"])
        )
        db.commit()

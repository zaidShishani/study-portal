from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.events import Event
from app.models.users import User
from app.schemas.common import Id
from app.schemas.events import EventCreate, EventOut, EventUpdate
from app.services import rrule

router = APIRouter(prefix="/api/events", tags=["events"])


def get_own_event(event_id: int, user: User, db: Session) -> Event:
    event = db.scalar(select(Event).where(Event.id == event_id, Event.user_id == user.id))
    if event is None:
        raise HTTPException(404, "Event not found")
    return event


def _check(start_at: datetime, end_at: datetime | None, rule: str | None) -> None:
    if end_at is not None and end_at < start_at:
        raise HTTPException(422, "end_at must not be before start_at")
    if rule is not None:
        try:
            rrule.validate(rule, start_at)
        except ValueError as e:
            raise HTTPException(422, f"rrule: {e}") from e


@router.post("", response_model=EventOut, status_code=201)
def create_event(body: EventCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Event:
    _check(body.start_at, body.end_at, body.rrule)
    event = Event(user_id=user.id, **body.model_dump())
    db.add(event)
    db.commit()
    return event


@router.get("/{event_id}", response_model=EventOut)
def get_event(event_id: Id, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Event:
    return get_own_event(event_id, user, db)


@router.patch("/{event_id}", response_model=EventOut)
def update_event(
    event_id: Id, body: EventUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Event:
    event = get_own_event(event_id, user, db)
    changes = body.model_dump(exclude_unset=True)
    for field in ("title", "start_at", "all_day"):
        if field in changes and changes[field] is None:
            raise HTTPException(422, f"{field} must not be null")
    # Validate the merged result before touching the row.
    _check(*(changes.get(f, getattr(event, f)) for f in ("start_at", "end_at", "rrule")))
    for field, value in changes.items():
        setattr(event, field, value)
    db.commit()
    return event


@router.delete("/{event_id}", status_code=204)
def delete_event(event_id: Id, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    db.delete(get_own_event(event_id, user, db))
    db.commit()
    return Response(status_code=204)

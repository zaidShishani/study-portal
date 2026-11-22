from datetime import date, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.core.time import today_for
from app.models.users import User
from app.services import rrule
from app.services.calendar import calendar

router = APIRouter(prefix="/api/calendar", tags=["calendar"])

ISO_DATE = r"^\d{4}-\d{2}-\d{2}$"
# Expansion walks from an event's start to the window; with start_at bounded too, this bounds the walk.
MAX_DISTANCE = timedelta(days=3653)  # ~10 years


def _parse(name: str, value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as e:
        raise HTTPException(422, f"{name} must be a valid YYYY-MM-DD date") from e


@router.get("")
def get_calendar(
    from_: str = Query(alias="from", pattern=ISO_DATE),
    to: str = Query(pattern=ISO_DATE),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Events and due items for the inclusive local dates [from, to] in the user's timezone."""
    first, last = _parse("from", from_), _parse("to", to)
    if last < first:
        raise HTTPException(422, "to must not be before from")
    if (last - first).days + 1 > rrule.MAX_WINDOW.days:
        raise HTTPException(422, f"range must be at most {rrule.MAX_WINDOW.days} days")
    today = today_for(user)
    if first < today - MAX_DISTANCE or last > today + MAX_DISTANCE:
        raise HTTPException(422, "dates must be within 10 years of today")
    return calendar(db, user, first, last)

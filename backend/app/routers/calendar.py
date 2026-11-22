from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.users import User
from app.services import rrule
from app.services.calendar import calendar

router = APIRouter(prefix="/api/calendar", tags=["calendar"])


@router.get("")
def get_calendar(
    first: date = Query(alias="from"),
    last: date = Query(alias="to"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Events and due items for the inclusive local dates [from, to] in the user's timezone."""
    if last < first:
        raise HTTPException(422, "to must not be before from")
    if (last - first).days + 1 > rrule.MAX_WINDOW.days:
        raise HTTPException(422, f"range must be at most {rrule.MAX_WINDOW.days} days")
    if first.year < rrule.MIN_YEAR or last.year >= rrule.MAX_YEAR:
        raise HTTPException(422, f"dates must be within {rrule.MIN_YEAR}-{rrule.MAX_YEAR - 1}")
    try:
        return calendar(db, user, first, last)
    except ValueError as e:
        raise HTTPException(422, str(e)) from e

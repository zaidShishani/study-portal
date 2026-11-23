from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Path, Response
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.events import Event, Notification
from app.models.users import User
from app.schemas.notifications import NotificationOut
from app.services import notifications

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

MAX_UNREAD = 50
BigId = Annotated[int, Path(gt=0, le=2**63 - 1)]  # notifications.id is bigint


@router.get("", response_model=list[NotificationOut])
def list_unread(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Any:
    notifications.sync(db, user, datetime.now(UTC))
    return db.execute(
        select(Notification.id, Notification.event_id, Event.title, Notification.occurrence_start, Notification.fire_at)
        .join(Event, Notification.event_id == Event.id)
        .where(Notification.user_id == user.id, Notification.read_at.is_(None))
        .order_by(Notification.fire_at.desc(), Notification.id.desc())
        .limit(MAX_UNREAD)
    ).all()


@router.post("/read-all", status_code=204)
def read_all(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    db.execute(
        update(Notification)
        .where(Notification.user_id == user.id, Notification.read_at.is_(None))
        .values(read_at=func.now())
    )
    db.commit()
    return Response(status_code=204)


@router.post("/{notification_id}/read", status_code=204)
def read_one(notification_id: BigId, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    notification = db.scalar(
        select(Notification).where(Notification.id == notification_id, Notification.user_id == user.id)
    )
    if notification is None:
        raise HTTPException(404, "Notification not found")
    if notification.read_at is None:  # idempotent: keep the first read time
        notification.read_at = func.now()
        db.commit()
    return Response(status_code=204)

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.users import User
from app.services import dashboard

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/today")
def get_today(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    return dashboard.today(db, user)

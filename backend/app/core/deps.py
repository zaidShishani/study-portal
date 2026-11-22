from collections.abc import Iterator

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.db import SessionLocal
from app.models.users import User


def get_db() -> Iterator[Session]:
    with SessionLocal() as db:
        yield db


def get_current_user(db: Session = Depends(get_db)) -> User:
    # Auth is deferred: everyone is user 1. WorkOS will replace only this function.
    return db.get_one(User, 1)

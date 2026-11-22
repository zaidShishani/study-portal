from sqlalchemy import func, inspect, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.main import app
from app.models.users import User

ROLLBACK_EMAIL = "rollback-check@example.com"


def test_migration_creates_users_and_seeds_user_1(db: Session):
    assert "users" in inspect(db.connection()).get_table_names()
    user = db.get(User, 1)
    assert user is not None
    assert user.timezone == "UTC"
    assert user.email is None
    assert user.created_at.tzinfo is not None


def test_get_current_user_returns_user_1(db: Session):
    assert get_current_user(db).id == 1


def test_new_users_do_not_collide_with_seeded_id(db: Session):
    user = User()
    db.add(user)
    db.flush()
    assert user.id > 1


def test_other_user_fixture_overrides_current_user(other_user: User):
    current = app.dependency_overrides[get_current_user]()
    assert current.id == other_user.id
    assert current.id != 1


# The next two tests run in file order: the first writes, the second proves it was rolled back.
def test_rollback_write(db: Session):
    db.add(User(email=ROLLBACK_EMAIL))
    db.commit()  # commits only the savepoint; the outer transaction is still rolled back
    assert db.scalar(select(func.count()).where(User.email == ROLLBACK_EMAIL)) == 1


def test_rollback_leaves_no_data(db: Session):
    assert db.scalar(select(func.count()).where(User.email == ROLLBACK_EMAIL)) == 0
    assert db.scalar(select(func.count()).select_from(User)) == 1

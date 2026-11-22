from collections.abc import Iterator

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, make_url, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user, get_db
from app.main import app
from app.models.users import User

TEST_DB = "study_portal_test"


@pytest.fixture(scope="session")
def engine() -> Iterator[Engine]:
    """Test DB next to the dev DB: created if missing, migrated once per session."""
    admin = create_engine(settings.database_url, isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        exists = conn.scalar(text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": TEST_DB})
        if not exists:
            conn.execute(text("CREATE DATABASE study_portal_test"))  # DDL can't bind the name
    admin.dispose()

    engine = create_engine(make_url(settings.database_url).set(database=TEST_DB))
    with engine.begin() as conn:
        cfg = Config("alembic.ini")
        cfg.attributes["connection"] = conn
        command.upgrade(cfg, "head")
    yield engine
    engine.dispose()


@pytest.fixture
def db(engine: Engine) -> Iterator[Session]:
    """Session inside an outer transaction that is rolled back after each test.

    Setup data that must survive a route-level db.rollback() should use db.commit():
    it only releases the savepoint; the outer transaction still rolls back.
    """
    with engine.connect() as conn:
        trans = conn.begin()
        session = Session(bind=conn, join_transaction_mode="create_savepoint")
        yield session
        session.close()
        trans.rollback()


@pytest.fixture
def client(db: Session) -> Iterator[TestClient]:
    app.dependency_overrides[get_db] = lambda: db
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def other_user(db: Session, client: TestClient) -> User:
    """A second user who becomes the current user, for ownership (404) tests."""
    user = User(email="other@example.com")
    db.add(user)
    db.commit()
    app.dependency_overrides[get_current_user] = lambda: user
    return user

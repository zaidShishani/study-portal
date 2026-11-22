import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.main import app
from app.models.notes import NoteFolder
from app.models.users import User
from app.routers import notes

PAGES = "/api/notes/pages"


@pytest.fixture
def foreign_folder(db: Session) -> NoteFolder:
    """A folder owned by a second user; the current user stays user 1."""
    db.add(stranger := User(email="stranger@example.com"))
    db.flush()
    db.add(folder := NoteFolder(user_id=stranger.id, name="theirs"))
    db.flush()
    return folder


# Raw SQL on purpose: proves the DB rejects cross-user links even when the router check is skipped.
@pytest.mark.parametrize(
    "sql",
    [
        "INSERT INTO note_folders (user_id, parent_id, name) VALUES (1, :fid, 'x')",
        "INSERT INTO note_pages (user_id, folder_id, title, content) VALUES (1, :fid, 'x', '')",
    ],
)
def test_cross_user_link_is_an_fk_violation(db: Session, foreign_folder: NoteFolder, sql: str):
    with pytest.raises(IntegrityError, match="violates foreign key constraint"), db.begin_nested():
        db.execute(text(sql), {"fid": foreign_folder.id})


def test_same_user_link_still_works(db: Session):
    db.execute(text("INSERT INTO note_folders (user_id, name) VALUES (1, 'p')"))
    parent_id = db.scalar(text("SELECT max(id) FROM note_folders WHERE user_id = 1"))
    db.execute(text("INSERT INTO note_folders (user_id, parent_id, name) VALUES (1, :p, 'c')"), {"p": parent_id})
    assert db.scalar(text("SELECT count(*) FROM note_folders WHERE parent_id = :p AND user_id = 1"), {"p": parent_id}) == 1


def test_folder_gone_after_ownership_check_is_404(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    # Simulate the folder being deleted between get_own_folder and commit: the FK fails at commit.
    page_id = client.post(PAGES, json={"title": "p"}).json()["id"]
    monkeypatch.setattr(notes, "get_own_folder", lambda *a: None)
    r = client.post(PAGES, json={"title": "x", "folder_id": 999999})
    assert (r.status_code, r.json()["detail"]) == (404, "Folder not found")
    assert client.patch(f"{PAGES}/{page_id}", json={"folder_id": 999999}).status_code == 404
    assert client.post("/api/notes/folders", json={"name": "x", "parent_id": 999999}).status_code == 404
    assert client.get(f"{PAGES}/{page_id}").json()["folder_id"] is None


def test_other_integrity_errors_are_not_turned_into_404(client: TestClient):
    # A current user missing from the DB violates the users FK, not a folder link: must surface, not 404.
    app.dependency_overrides[get_current_user] = lambda: User(id=999999)
    with pytest.raises(IntegrityError, match="note_folders_user_id_fkey"):
        client.post("/api/notes/folders", json={"name": "x"})


def test_oversized_body_is_413(client: TestClient):
    r = client.post(PAGES, content=b"x" * 1_000_001, headers={"Content-Type": "application/json"})
    assert (r.status_code, r.json()["detail"]) == (413, "Request body too large")


def test_max_size_page_of_4_byte_chars_is_accepted(client: TestClient):
    # Browsers send non-ASCII as raw UTF-8: 200k emoji = 800 KB, under the 1 MB limit.
    body = json.dumps({"title": "x", "content": "\U0001f600" * 200_000}, ensure_ascii=False).encode()
    r = client.post(PAGES, content=body, headers={"Content-Type": "application/json"})
    assert r.status_code == 201
    assert len(r.json()["content"]) == 200_000

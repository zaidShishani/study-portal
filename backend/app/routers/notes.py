from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import Row, func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.notes import NoteFolder, NotePage
from app.models.users import User
from app.schemas.common import Id
from app.schemas.notes import (
    FolderCreate,
    FolderOut,
    FolderUpdate,
    PageCreate,
    PageListItem,
    PageOut,
    PageUpdate,
)

router = APIRouter(prefix="/api/notes", tags=["notes"])


def get_own_folder(folder_id: int, user: User, db: Session) -> NoteFolder:
    folder = db.scalar(select(NoteFolder).where(NoteFolder.id == folder_id, NoteFolder.user_id == user.id))
    if folder is None:
        raise HTTPException(404, "Folder not found")
    return folder


def _subtree_ids(folder_id: int, user: User, db: Session) -> set[int]:
    """The folder plus all its descendants, via a recursive CTE.

    UNION (not UNION ALL) so the query still terminates if a cycle ever exists.
    """
    mine = NoteFolder.user_id == user.id
    tree = select(NoteFolder.id).where(NoteFolder.id == folder_id, mine).cte(recursive=True)
    tree = tree.union(select(NoteFolder.id).where(NoteFolder.parent_id == tree.c.id, mine))
    return set(db.scalars(select(tree.c.id)))


@router.get("/folders", response_model=list[FolderOut])
def list_folders(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[NoteFolder]:
    # shortcut: unpaginated, fine for one person's folders; paginate if lists get large.
    return list(db.scalars(select(NoteFolder).where(NoteFolder.user_id == user.id).order_by(NoteFolder.id)))


@router.post("/folders", response_model=FolderOut, status_code=201)
def create_folder(
    body: FolderCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> NoteFolder:
    if body.parent_id is not None:
        get_own_folder(body.parent_id, user, db)
    folder = NoteFolder(user_id=user.id, parent_id=body.parent_id, name=body.name)
    db.add(folder)
    db.commit()
    return folder


@router.patch("/folders/{folder_id}", response_model=FolderOut)
def update_folder(
    folder_id: Id, body: FolderUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> NoteFolder:
    folder = get_own_folder(folder_id, user, db)
    if "name" in body.model_fields_set and body.name is None:
        raise HTTPException(422, "name must not be null")
    if body.parent_id is not None:
        # Serialize this user's moves until commit, else two parallel moves (A under B, B under A) both pass.
        # shortcut: no automated two-connection race test (verified live: 0 cycles in 50 parallel runs); add one if this logic changes.
        db.execute(select(func.pg_advisory_xact_lock(user.id)))
        get_own_folder(body.parent_id, user, db)
        if body.parent_id in _subtree_ids(folder.id, user, db):
            raise HTTPException(400, "Cannot move a folder into itself or a descendant")
    if body.name is not None:
        folder.name = body.name
    if "parent_id" in body.model_fields_set:
        folder.parent_id = body.parent_id
    db.commit()
    return folder


@router.delete("/folders/{folder_id}", status_code=204)
def delete_folder(folder_id: Id, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    db.delete(get_own_folder(folder_id, user, db))  # subtree goes via the FK's ON DELETE CASCADE
    db.commit()
    return Response(status_code=204)


def get_own_page(page_id: int, user: User, db: Session) -> NotePage:
    page = db.scalar(select(NotePage).where(NotePage.id == page_id, NotePage.user_id == user.id))
    if page is None:
        raise HTTPException(404, "Page not found")
    return page


@router.get("/pages", response_model=list[PageListItem])
def list_pages(
    folder_id: Annotated[int | None, Query(gt=0, le=2_147_483_647)] = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Row[Any]]:
    """Pages in one folder, or at root when folder_id is omitted."""
    if folder_id is not None:
        get_own_folder(folder_id, user, db)
    # shortcut: unpaginated, fine for one folder's pages; paginate if lists get large.
    # Only list columns are loaded, so page content isn't read for the list.
    return list(
        db.execute(
            select(NotePage.id, NotePage.title, NotePage.folder_id, NotePage.updated_at)
            .where(NotePage.user_id == user.id, NotePage.folder_id == folder_id)  # None -> IS NULL (root)
            .order_by(NotePage.id)
        )
    )


@router.post("/pages", response_model=PageOut, status_code=201)
def create_page(body: PageCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> NotePage:
    if body.folder_id is not None:
        get_own_folder(body.folder_id, user, db)
    page = NotePage(user_id=user.id, folder_id=body.folder_id, title=body.title, content=body.content)
    db.add(page)
    db.commit()
    return page


@router.get("/pages/{page_id}", response_model=PageOut)
def get_page(page_id: Id, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> NotePage:
    return get_own_page(page_id, user, db)


@router.patch("/pages/{page_id}", response_model=PageOut)
def update_page(
    page_id: Id, body: PageUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> NotePage:
    page = get_own_page(page_id, user, db)
    for field in ("title", "content"):
        if field in body.model_fields_set and getattr(body, field) is None:
            raise HTTPException(422, f"{field} must not be null")
    if body.folder_id is not None:
        get_own_folder(body.folder_id, user, db)
    if body.title is not None:
        page.title = body.title
    if body.content is not None:
        page.content = body.content
    if "folder_id" in body.model_fields_set:
        page.folder_id = body.folder_id
    db.commit()
    return page


@router.delete("/pages/{page_id}", status_code=204)
def delete_page(page_id: Id, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    db.delete(get_own_page(page_id, user, db))
    db.commit()
    return Response(status_code=204)

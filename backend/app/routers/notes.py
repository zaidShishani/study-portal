from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.notes import NoteFolder
from app.models.users import User
from app.schemas.common import Id
from app.schemas.notes import FolderCreate, FolderOut, FolderUpdate

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

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import ColumnElement, func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.roadmaps import Checkpoint, Roadmap
from app.models.users import User
from app.schemas.common import Id
from app.schemas.roadmaps import (
    MAX_CHECKPOINTS,
    CheckpointCreate,
    CheckpointOrder,
    CheckpointOut,
    CheckpointUpdate,
    RoadmapCreate,
    RoadmapDetail,
    RoadmapOut,
    RoadmapUpdate,
)

router = APIRouter(tags=["roadmaps"])


def get_own_roadmap(roadmap_id: int, user: User, db: Session, lock: bool = False) -> Roadmap:
    query = select(Roadmap).where(Roadmap.id == roadmap_id, Roadmap.user_id == user.id)
    # lock=True serializes writers that read then change this roadmap's checkpoints (append, reorder, delete).
    roadmap = db.scalar(query.with_for_update() if lock else query)
    if roadmap is None:
        raise HTTPException(404, "Roadmap not found")
    return roadmap


def get_own_checkpoint(checkpoint_id: int, user: User, db: Session) -> Checkpoint:
    checkpoint = db.scalar(
        select(Checkpoint)
        .join(Roadmap, Roadmap.id == Checkpoint.roadmap_id)
        .where(Checkpoint.id == checkpoint_id, Roadmap.user_id == user.id)
    )
    if checkpoint is None:
        raise HTTPException(404, "Checkpoint not found")
    return checkpoint


def _checkpoints(roadmap_id: int, db: Session) -> list[Checkpoint]:
    return list(
        db.scalars(
            select(Checkpoint).where(Checkpoint.roadmap_id == roadmap_id).order_by(Checkpoint.position, Checkpoint.id)
        )
    )


def _roadmaps_out(user: User, db: Session, *where: ColumnElement[bool]) -> list[RoadmapOut]:
    """The user's roadmaps with checkpoint counts, in one query (correlated subqueries, no N+1)."""
    total = select(func.count()).where(Checkpoint.roadmap_id == Roadmap.id).scalar_subquery()
    done = (
        select(func.count())
        .where(Checkpoint.roadmap_id == Roadmap.id, Checkpoint.done_at.is_not(None))
        .scalar_subquery()
    )
    rows = db.execute(
        select(Roadmap, done, total).where(Roadmap.user_id == user.id, *where).order_by(Roadmap.created_at, Roadmap.id)
    )
    return [
        RoadmapOut.model_validate(roadmap).model_copy(update={"done_count": d, "total_count": t})
        for roadmap, d, t in rows
    ]


def _roadmap_detail(roadmap_id: int, user: User, db: Session) -> RoadmapDetail:
    roadmaps = _roadmaps_out(user, db, Roadmap.id == roadmap_id)
    if not roadmaps:
        raise HTTPException(404, "Roadmap not found")
    checkpoints = [CheckpointOut.model_validate(c) for c in _checkpoints(roadmap_id, db)]
    return RoadmapDetail(**roadmaps[0].model_dump(), checkpoints=checkpoints)


@router.get("/api/roadmaps", response_model=list[RoadmapOut])
def list_roadmaps(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[RoadmapOut]:
    # shortcut: unpaginated, fine for one person's roadmaps; paginate if lists get large.
    return _roadmaps_out(user, db)


@router.post("/api/roadmaps", response_model=RoadmapDetail, status_code=201)
def create_roadmap(
    body: RoadmapCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> RoadmapDetail:
    roadmap = Roadmap(user_id=user.id, title=body.title, description=body.description)
    db.add(roadmap)
    db.commit()
    return _roadmap_detail(roadmap.id, user, db)


@router.get("/api/roadmaps/{roadmap_id}", response_model=RoadmapDetail)
def get_roadmap(roadmap_id: Id, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> RoadmapDetail:
    return _roadmap_detail(roadmap_id, user, db)


@router.patch("/api/roadmaps/{roadmap_id}", response_model=RoadmapDetail)
def update_roadmap(
    roadmap_id: Id, body: RoadmapUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> RoadmapDetail:
    roadmap = get_own_roadmap(roadmap_id, user, db)
    for field in body.model_fields_set:
        setattr(roadmap, field, getattr(body, field))
    db.commit()
    return _roadmap_detail(roadmap.id, user, db)


@router.delete("/api/roadmaps/{roadmap_id}", status_code=204)
def delete_roadmap(roadmap_id: Id, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    db.delete(get_own_roadmap(roadmap_id, user, db))  # checkpoints go via the FK's ON DELETE CASCADE
    db.commit()
    return Response(status_code=204)


@router.post("/api/roadmaps/{roadmap_id}/checkpoints", response_model=CheckpointOut, status_code=201)
def create_checkpoint(
    roadmap_id: Id, body: CheckpointCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Checkpoint:
    roadmap = get_own_roadmap(roadmap_id, user, db, lock=True)
    count, last = db.execute(
        select(func.count(), func.max(Checkpoint.position)).where(Checkpoint.roadmap_id == roadmap.id)
    ).one()
    if count >= MAX_CHECKPOINTS:
        raise HTTPException(409, "Roadmap is full")
    checkpoint = Checkpoint(roadmap_id=roadmap.id, position=0 if last is None else last + 1, **body.model_dump())
    db.add(checkpoint)
    db.commit()
    return checkpoint


@router.put("/api/roadmaps/{roadmap_id}/checkpoints/order", response_model=list[CheckpointOut])
def reorder_checkpoints(
    roadmap_id: Id, body: CheckpointOrder, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[Checkpoint]:
    roadmap = get_own_roadmap(roadmap_id, user, db, lock=True)
    by_id = {c.id: c for c in _checkpoints(roadmap.id, db)}
    # Same length + same set means no missing, extra, duplicate or foreign ids.
    if len(body.ids) != len(by_id) or set(body.ids) != by_id.keys():
        raise HTTPException(400, "ids must be exactly this roadmap's checkpoint ids")
    for position, checkpoint_id in enumerate(body.ids):
        by_id[checkpoint_id].position = position
    db.commit()
    return [by_id[i] for i in body.ids]


@router.patch("/api/checkpoints/{checkpoint_id}", response_model=CheckpointOut)
def update_checkpoint(
    checkpoint_id: Id, body: CheckpointUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Checkpoint:
    checkpoint = get_own_checkpoint(checkpoint_id, user, db)
    for field in body.model_fields_set - {"done"}:
        setattr(checkpoint, field, getattr(body, field))
    if body.done is False:
        checkpoint.done_at = None
    elif body.done and checkpoint.done_at is None:  # re-sending done keeps the original time
        checkpoint.done_at = func.now()
    db.commit()
    db.refresh(checkpoint)  # load the server-side done_at
    return checkpoint


@router.delete("/api/checkpoints/{checkpoint_id}", status_code=204)
def delete_checkpoint(
    checkpoint_id: Id, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Response:
    checkpoint = get_own_checkpoint(checkpoint_id, user, db)
    get_own_roadmap(checkpoint.roadmap_id, user, db, lock=True)  # else a parallel reorder hits a vanished row
    db.delete(checkpoint)
    db.commit()
    return Response(status_code=204)

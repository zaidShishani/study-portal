from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import srs
from app.core.deps import get_current_user, get_db
from app.core.time import today_for
from app.models.problems import Difficulty, Pattern, Problem
from app.models.users import User
from app.schemas.common import Id
from app.schemas.problems import ProblemCreate, ProblemOut, ProblemUpdate

router = APIRouter(prefix="/api/problems", tags=["problems"])


def get_own_problem(problem_id: int, user: User, db: Session) -> Problem:
    problem = db.scalar(select(Problem).where(Problem.id == problem_id, Problem.user_id == user.id))
    if problem is None:
        raise HTTPException(404, "Problem not found")
    return problem


@router.get("", response_model=list[ProblemOut])
def list_problems(
    difficulty: Difficulty | None = None,
    pattern: Pattern | None = None,
    status: Literal["active", "due", "retired", "all"] = "active",
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Problem]:
    query = select(Problem).where(Problem.user_id == user.id).order_by(Problem.created_at, Problem.id)
    if difficulty is not None:
        query = query.where(Problem.difficulty == difficulty)
    if pattern is not None:
        query = query.where(Problem.pattern == pattern)
    if status == "active":
        query = query.where(Problem.retired_at.is_(None))
    elif status == "due":
        query = query.where(Problem.retired_at.is_(None), Problem.due_date <= today_for(user))
    elif status == "retired":
        query = query.where(Problem.retired_at.is_not(None))
    # shortcut: unpaginated, fine for one person's problems; paginate if lists get large.
    return list(db.scalars(query))


@router.post("", response_model=ProblemOut, status_code=201)
def create_problem(
    body: ProblemCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Problem:
    stage, due_date = srs.new_item(today_for(user))
    # mode="json" turns HttpUrl into the plain string the column stores.
    problem = Problem(user_id=user.id, stage=stage, due_date=due_date, **body.model_dump(mode="json"))
    db.add(problem)
    db.commit()
    return problem


@router.get("/{problem_id}", response_model=ProblemOut)
def get_problem(problem_id: Id, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Problem:
    return get_own_problem(problem_id, user, db)


@router.patch("/{problem_id}", response_model=ProblemOut)
def update_problem(
    problem_id: Id, body: ProblemUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Problem:
    problem = get_own_problem(problem_id, user, db)
    for field, value in body.model_dump(mode="json", exclude_unset=True).items():
        setattr(problem, field, value)
    db.commit()
    return problem


@router.delete("/{problem_id}", status_code=204)
def delete_problem(problem_id: Id, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    db.delete(get_own_problem(problem_id, user, db))
    db.commit()
    return Response(status_code=204)

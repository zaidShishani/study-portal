from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import ColumnElement, func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.core.time import today_for
from app.models.decks import Card, Deck
from app.models.users import User
from app.schemas.common import Id
from app.schemas.decks import DeckCreate, DeckOut, DeckUpdate

router = APIRouter(prefix="/api/decks", tags=["decks"])


def get_own_deck(deck_id: int, user: User, db: Session) -> Deck:
    deck = db.scalar(select(Deck).where(Deck.id == deck_id, Deck.user_id == user.id))
    if deck is None:
        raise HTTPException(404, "Deck not found")
    return deck


def _decks_out(user: User, db: Session, *where: ColumnElement[bool]) -> list[DeckOut]:
    """The user's decks with card counts, in one query (correlated subqueries, no N+1)."""
    card_count = select(func.count()).where(Card.deck_id == Deck.id).scalar_subquery()
    due_count = (
        select(func.count())
        .where(Card.deck_id == Deck.id, Card.retired_at.is_(None), Card.due_date <= today_for(user))
        .scalar_subquery()
    )
    rows = db.execute(
        select(Deck, card_count, due_count)
        .where(Deck.user_id == user.id, *where)
        .order_by(Deck.created_at, Deck.id)
    )
    return [
        DeckOut.model_validate(deck).model_copy(update={"card_count": cards, "due_count": due})
        for deck, cards, due in rows
    ]


def _deck_out(deck_id: int, user: User, db: Session) -> DeckOut:
    decks = _decks_out(user, db, Deck.id == deck_id)
    if not decks:
        raise HTTPException(404, "Deck not found")
    return decks[0]


@router.get("", response_model=list[DeckOut])
def list_decks(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[DeckOut]:
    # shortcut: unpaginated, fine for one person's decks; paginate if lists get large.
    return _decks_out(user, db)


@router.post("", response_model=DeckOut, status_code=201)
def create_deck(body: DeckCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> DeckOut:
    deck = Deck(user_id=user.id, title=body.title)
    db.add(deck)
    db.commit()
    return _deck_out(deck.id, user, db)


@router.get("/{deck_id}", response_model=DeckOut)
def get_deck(deck_id: Id, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> DeckOut:
    return _deck_out(deck_id, user, db)


@router.patch("/{deck_id}", response_model=DeckOut)
def update_deck(
    deck_id: Id, body: DeckUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> DeckOut:
    deck = get_own_deck(deck_id, user, db)
    deck.title = body.title
    db.commit()
    return _deck_out(deck.id, user, db)


@router.delete("/{deck_id}", status_code=204)
def delete_deck(deck_id: Id, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    db.delete(get_own_deck(deck_id, user, db))  # cards go via the FK's ON DELETE CASCADE
    db.commit()
    return Response(status_code=204)

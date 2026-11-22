from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.decks import Deck
from app.models.users import User
from app.schemas.decks import DeckCreate, DeckOut, DeckUpdate

router = APIRouter(prefix="/api/decks", tags=["decks"])


def _own_deck(deck_id: int, user: User, db: Session) -> Deck:
    deck = db.scalar(select(Deck).where(Deck.id == deck_id, Deck.user_id == user.id))
    if deck is None:
        raise HTTPException(404, "Deck not found")
    return deck


@router.get("", response_model=list[DeckOut])
def list_decks(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[Deck]:
    # shortcut: unpaginated, fine for one person's decks; paginate if lists get large.
    return list(db.scalars(select(Deck).where(Deck.user_id == user.id).order_by(Deck.created_at, Deck.id)))


@router.post("", response_model=DeckOut, status_code=201)
def create_deck(body: DeckCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Deck:
    deck = Deck(user_id=user.id, title=body.title)
    db.add(deck)
    db.commit()
    return deck


@router.get("/{deck_id}", response_model=DeckOut)
def get_deck(deck_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Deck:
    return _own_deck(deck_id, user, db)


@router.patch("/{deck_id}", response_model=DeckOut)
def update_deck(
    deck_id: int, body: DeckUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Deck:
    deck = _own_deck(deck_id, user, db)
    deck.title = body.title
    db.commit()
    return deck


@router.delete("/{deck_id}", status_code=204)
def delete_deck(deck_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    db.delete(_own_deck(deck_id, user, db))
    db.commit()
    return Response(status_code=204)

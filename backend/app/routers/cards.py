from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import srs
from app.core.deps import get_current_user, get_db
from app.core.time import today_for
from app.models.decks import Card, Deck
from app.models.users import User
from app.routers.decks import get_own_deck
from app.schemas.cards import CardCreate, CardOut, CardUpdate
from app.schemas.common import Id

router = APIRouter(prefix="/api", tags=["cards"])


def get_own_card(card_id: int, user: User, db: Session) -> Card:
    card = db.scalar(select(Card).join(Deck).where(Card.id == card_id, Deck.user_id == user.id))
    if card is None:
        raise HTTPException(404, "Card not found")
    return card


@router.get("/decks/{deck_id}/cards", response_model=list[CardOut])
def list_cards(
    deck_id: Id,
    status: Literal["active", "retired", "all"] = "active",
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Card]:
    deck = get_own_deck(deck_id, user, db)
    query = select(Card).where(Card.deck_id == deck.id).order_by(Card.created_at, Card.id)
    if status == "active":
        query = query.where(Card.retired_at.is_(None))
    elif status == "retired":
        query = query.where(Card.retired_at.is_not(None))
    # shortcut: unpaginated, fine for one person's deck; paginate if decks get huge.
    return list(db.scalars(query))


@router.post("/decks/{deck_id}/cards", response_model=CardOut, status_code=201)
def create_card(
    deck_id: Id, body: CardCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Card:
    deck = get_own_deck(deck_id, user, db)
    stage, due_date = srs.new_item(today_for(user))
    card = Card(deck_id=deck.id, front=body.front, back=body.back, stage=stage, due_date=due_date)
    db.add(card)
    db.commit()
    return card


@router.get("/cards/{card_id}", response_model=CardOut)
def get_card(card_id: Id, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Card:
    return get_own_card(card_id, user, db)


@router.patch("/cards/{card_id}", response_model=CardOut)
def update_card(
    card_id: Id, body: CardUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Card:
    card = get_own_card(card_id, user, db)
    if body.front is not None:
        card.front = body.front
    if body.back is not None:
        card.back = body.back
    db.commit()
    return card


@router.delete("/cards/{card_id}", status_code=204)
def delete_card(card_id: Id, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    db.delete(get_own_card(card_id, user, db))
    db.commit()
    return Response(status_code=204)

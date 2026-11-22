from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import StrictBool
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import srs
from app.core.deps import get_current_user, get_db
from app.core.time import today_for
from app.models.decks import Card, Deck
from app.models.users import User
from app.routers.cards import get_own_card
from app.routers.decks import get_own_deck
from app.schemas.cards import CardOut
from app.schemas.common import Id, InputModel

router = APIRouter(prefix="/api", tags=["review"])


# Only `correct` comes from the client; stage and today are always server-side.
class ReviewIn(InputModel):
    correct: StrictBool


@router.get("/review/cards", response_model=list[CardOut])
def due_cards(
    deck_id: Annotated[int | None, Query(gt=0, le=2_147_483_647)] = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Card]:
    query = (
        select(Card)
        .join(Deck)
        .where(Deck.user_id == user.id, Card.retired_at.is_(None), Card.due_date <= today_for(user))
        .order_by(Card.due_date, Card.id)
    )
    if deck_id is not None:
        query = query.where(Card.deck_id == get_own_deck(deck_id, user, db).id)
    # shortcut: unbounded queue, fine for one person's cards; add a limit if queues get huge.
    return list(db.scalars(query))


@router.post("/cards/{card_id}/review", response_model=CardOut)
def review_card(
    card_id: Id, body: ReviewIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Card:
    card = get_own_card(card_id, user, db, for_update=True)
    today = today_for(user)
    if card.retired_at is not None:
        raise HTTPException(409, "Card is retired")
    if card.due_date is None or card.due_date > today:
        raise HTTPException(409, "Card is not due yet")
    card.stage, card.due_date, retired = srs.review(card.stage, body.correct, today)
    now = datetime.now(UTC)
    card.review_count += 1
    card.last_reviewed_at = now
    if retired:
        card.retired_at = now
    db.commit()
    return card


@router.post("/cards/{card_id}/unretire", response_model=CardOut)
def unretire_card(card_id: Id, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Card:
    card = get_own_card(card_id, user, db, for_update=True)
    if card.retired_at is None:
        raise HTTPException(409, "Card is not retired")
    card.stage, card.due_date = srs.unretire(today_for(user))
    card.retired_at = None
    db.commit()
    return card

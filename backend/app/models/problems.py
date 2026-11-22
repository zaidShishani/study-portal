from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Identity,
    Index,
    SmallInteger,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Difficulty(StrEnum):
    EASY = "Easy"
    MEDIUM = "Medium"
    HARD = "Hard"


class LastResult(StrEnum):
    SOLVED = "solved"
    SOLVED_WITH_HINT = "solved_with_hint"
    FAILED = "failed"


class Pattern(StrEnum):
    TWO_POINTERS = "Two Pointers"
    SLIDING_WINDOW = "Sliding Window"
    BINARY_SEARCH = "Binary Search"
    STACK = "Stack"
    LINKED_LIST = "Linked List"
    TREE = "Tree"
    TRIE = "Trie"
    HEAP = "Heap"
    GRAPH = "Graph"
    BFS = "BFS"
    DFS = "DFS"
    BACKTRACKING = "Backtracking"
    DP = "DP"
    GREEDY = "Greedy"
    INTERVALS = "Intervals"
    UNION_FIND = "Union Find"
    BIT_MANIPULATION = "Bit Manipulation"
    MATH = "Math"


def _pg_enum(enum: type[StrEnum], name: str) -> Enum:
    # Store the values ("Two Pointers"), not the Python member names.
    return Enum(enum, name=name, values_callable=lambda e: [m.value for m in e])


class Problem(Base):
    __tablename__ = "problems"
    __table_args__ = (
        CheckConstraint("stage BETWEEN 0 AND 4", name="ck_problems_stage"),
        Index("ix_problems_user_id_due_date", "user_id", "due_date"),
    )

    id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(255))
    link: Mapped[str | None] = mapped_column(Text)
    difficulty: Mapped[Difficulty] = mapped_column(_pg_enum(Difficulty, "problem_difficulty"))
    pattern: Mapped[Pattern] = mapped_column(_pg_enum(Pattern, "problem_pattern"))
    key_insight: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    minutes: Mapped[int | None] = mapped_column(SmallInteger)
    last_result: Mapped[LastResult | None] = mapped_column(_pg_enum(LastResult, "problem_last_result"))
    solved_date: Mapped[date | None] = mapped_column(Date)
    review_count: Mapped[int] = mapped_column(server_default="0")
    # Written only from app.core.srs results.
    stage: Mapped[int] = mapped_column(SmallInteger)
    due_date: Mapped[date | None] = mapped_column(Date)
    retired_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

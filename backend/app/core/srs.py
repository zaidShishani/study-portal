from datetime import date, timedelta

INTERVALS = [1, 3, 7, 21]  # days
MAX_STAGE = len(INTERVALS)


def new_item(today: date) -> tuple[int, date]:
    return 0, today


def review(stage: int, correct: bool, today: date) -> tuple[int, date | None, bool]:
    """Returns (stage, due_date, retired)."""
    if not 0 <= stage <= MAX_STAGE:
        raise ValueError(f"invalid stage {stage}")
    if not correct:
        return 1, today + timedelta(days=1), False
    if stage == MAX_STAGE:
        return MAX_STAGE, None, True
    return stage + 1, today + timedelta(days=INTERVALS[stage]), False


def unretire(today: date) -> tuple[int, date]:
    return 1, today + timedelta(days=1)

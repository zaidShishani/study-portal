from datetime import date, timedelta

import pytest

from app.core.srs import new_item, review, unretire

TODAY = date(2026, 1, 1)


def days(n):
    return TODAY + timedelta(days=n)


def test_new_item_is_stage_0_due_today():
    assert new_item(TODAY) == (0, TODAY)


@pytest.mark.parametrize("stage,expected", [
    (0, (1, days(1), False)),
    (1, (2, days(3), False)),
    (2, (3, days(7), False)),
    (3, (4, days(21), False)),
    (4, (4, None, True)),
])
def test_right(stage, expected):
    assert review(stage, True, TODAY) == expected


@pytest.mark.parametrize("stage", range(5))
def test_wrong_resets_to_day_1(stage):
    assert review(stage, False, TODAY) == (1, days(1), False)


def test_full_walk_to_retirement():
    stage, due = new_item(TODAY)
    retired = False
    gaps = []
    for _ in range(5):
        prev = due
        stage, due, retired = review(stage, True, due)
        if due:
            gaps.append((due - prev).days)
    assert retired
    assert gaps == [1, 3, 7, 21]
    assert (stage, due) == (4, None)


def test_unretire():
    assert unretire(TODAY) == (1, days(1))


def test_due_date_crosses_year_boundary():
    assert review(3, True, date(2026, 12, 20)) == (4, date(2027, 1, 10), False)


@pytest.mark.parametrize("stage", [-1, 5, True, 2.0])
def test_invalid_stage(stage):
    with pytest.raises(ValueError):
        review(stage, True, TODAY)

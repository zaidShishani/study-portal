from typing import Annotated

from fastapi import Path
from pydantic import AfterValidator, BaseModel, ConfigDict

# Path ids must fit Postgres integer, else the query errors with a 500.
Id = Annotated[int, Path(gt=0, le=2_147_483_647)]


def _reject_nul(v: str) -> str:
    if "\x00" in v:
        raise ValueError("must not contain NUL characters")  # Postgres text can't store them
    return v


NoNul = AfterValidator(_reject_nul)


class InputModel(BaseModel):
    """Base for request bodies: unknown fields (e.g. user_id) are rejected, not ignored."""

    model_config = ConfigDict(extra="forbid")

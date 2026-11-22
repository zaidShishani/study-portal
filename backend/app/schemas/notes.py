from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

from app.schemas.common import Id, InputModel, NoNul

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200), NoNul]


class FolderCreate(InputModel):
    name: Name
    parent_id: Id | None = None


class FolderUpdate(InputModel):
    # Omitted parent_id keeps it; explicit null moves to root (router checks model_fields_set).
    name: Name | None = None
    parent_id: Id | None = None


class FolderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    parent_id: int | None
    name: str

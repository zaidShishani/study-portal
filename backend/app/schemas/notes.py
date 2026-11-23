from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StrictInt, StringConstraints

from app.schemas.common import InputModel, NoNul

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200), NoNul]
# Strict so JSON true isn't coerced to 1; bounded to Postgres integer.
FolderId = Annotated[StrictInt, Field(gt=0, le=2_147_483_647)]
Content = Annotated[str, Field(max_length=200_000), NoNul]


class FolderCreate(InputModel):
    name: Name
    parent_id: FolderId | None = None


class FolderUpdate(InputModel):
    # Omitted parent_id keeps it; explicit null moves to root (router checks model_fields_set).
    name: Name | None = None
    parent_id: FolderId | None = None


class FolderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    parent_id: int | None
    name: str


class PageCreate(InputModel):
    title: Name
    content: Content = ""
    folder_id: FolderId | None = None


class PageUpdate(InputModel):
    # Omitted folder_id keeps it; explicit null moves to root (router checks model_fields_set).
    title: Name | None = None
    content: Content | None = None
    folder_id: FolderId | None = None


class PageListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    folder_id: int | None
    updated_at: datetime


class RecentPageItem(PageListItem):
    folder_name: str | None


class PageOut(PageListItem):
    content: str
    created_at: datetime

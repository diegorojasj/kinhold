from typing import Annotated, Literal

from pydantic import Field

from common.sync import ClientId, IsoDateTime, RecordSchema

# Aisles, same ids as CATEGORIES in frontend/src/stores/shopping.ts.
Category = Literal[
    "produce", "bakery", "deli", "meat", "seafood", "dairy", "breakfast", "pantry", "condiments", "snacks",
    "drinks", "alcohol", "frozen", "household", "personal", "health", "baby", "pets", "other",
]  # fmt: skip

Name = Annotated[str, Field(min_length=1, max_length=120)]


class ItemRecord(RecordSchema):
    name: Name
    qty: Annotated[str, Field(max_length=40)] = ""
    note: Annotated[str, Field(max_length=500)] = ""
    category: Category = "other"
    checked: bool = False
    checked_by: ClientId | None = None
    added_by: ClientId
    created_at: IsoDateTime
    updated_at: IsoDateTime


class CatalogRecord(RecordSchema):
    name: Name
    category: Category = "other"
    times_added: Annotated[int, Field(ge=0)] = 0
    last_added_at: IsoDateTime

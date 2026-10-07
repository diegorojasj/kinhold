from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from ..auth import Actor
from .models import SyncedModel
from .schemas import RecordSchema


class RejectedError(Exception):
    """An op the server refuses (permission or business rule); the device reverts to the server's record."""

    def __init__(self, message: str, code: str = "forbidden") -> None:
        super().__init__(message)
        self.code = code
        self.message = message


# Called with the stored row (None if new) and the fields an op is about to change (python names, raw
# values) before they are applied; raises RejectedError to refuse. The row is typed Any so each service can
# annotate its own model.
Authorizer = Callable[[Actor, Any, dict[str, Any]], None]


@dataclass(frozen=True)
class Collection:
    """One kind of synced record in a service, e.g. shopping `items`."""

    name: str
    model: type[SyncedModel]
    schema: type[RecordSchema]
    authorize: Authorizer | None = None
    # (field, n): keep only the n newest records by that field; devices trim the same way (activity feed).
    retain: tuple[str, int] | None = None
    wire_names: dict[str, str] = field(init=False, repr=False)

    def __post_init__(self) -> None:
        names = {(info.alias or name): name for name, info in self.schema.model_fields.items()}
        object.__setattr__(self, "wire_names", {**names, "deleted": "deleted"})

    def incoming(self, fields: dict[str, Any]) -> dict[str, Any]:
        """Wire (camelCase) fields → python names. Unknown fields are dropped so newer clients keep working."""
        return {self.wire_names[k]: v for k, v in fields.items() if k in self.wire_names}

    def current(self, row: SyncedModel) -> dict[str, Any]:
        return {name: getattr(row, name) for name in self.schema.model_fields}

    def serialize(self, row: SyncedModel) -> dict[str, Any]:
        head = {"id": row.record_id, "householdId": row.household_id}
        if row.deleted:
            return {**head, "deleted": True}
        body = self.schema.model_validate(self.current(row)).model_dump(mode="json", by_alias=True)
        return {**head, **body, "deleted": False}

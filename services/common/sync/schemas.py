from datetime import UTC, datetime
from typing import Annotated, Any, Literal

from dateutil.rrule import rrulestr
from pydantic import AfterValidator, AwareDatetime, BaseModel, ConfigDict, Field, PlainSerializer
from pydantic.alias_generators import to_camel


def _js_iso(value: datetime) -> str:
    """Same shape as JavaScript's `toISOString()`, so dates sort the same on server and client."""
    return value.astimezone(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


IsoDateTime = Annotated[AwareDatetime, PlainSerializer(_js_iso, return_type=str, when_used="json")]


class RecordSchema(BaseModel):
    """Fields of one synced record: snake_case in Python and the database, camelCase on the wire."""

    model_config = ConfigDict(alias_generator=to_camel, validate_by_name=True, validate_by_alias=True)


class WireModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, validate_by_name=True, validate_by_alias=True)


class Op(WireModel):
    op_id: str = Field(max_length=64)
    collection: str = Field(max_length=40)
    id: str = Field(min_length=1, max_length=200)
    # Client time in ms (already corrected for the device's clock offset).
    ts: int = Field(ge=0)
    fields: dict[str, Any]


class PushIn(WireModel):
    ops: list[Op] = Field(max_length=500)


class OpResult(WireModel):
    op_id: str
    status: Literal["ok", "rejected"]
    code: str | None = None
    message: str | None = None
    # On rejection: the server's version of the record (None if it doesn't exist), so the device can revert.
    record: dict[str, Any] | None = None


class PushOut(WireModel):
    results: list[OpResult]
    server_time: int


class Change(WireModel):
    collection: str
    seq: int
    record: dict[str, Any]


class PullOut(WireModel):
    changes: list[Change]
    cursor: int
    more: bool
    # The device's cursor is ahead of the server (database restored or wiped): start again from 0.
    reset: bool = False
    server_time: int


def _check_rrule(value: str) -> str:
    """D-07: repeat rules are RFC 5545 RRULE strings (without the `RRULE:` prefix), as the frontend writes them."""
    try:
        rrulestr(value, dtstart=datetime(2000, 1, 1, tzinfo=UTC))
    except (ValueError, TypeError) as exc:
        msg = f"not a valid RRULE: {exc}"
        raise ValueError(msg) from exc
    return value


RRule = Annotated[str, Field(min_length=6, max_length=300), AfterValidator(_check_rrule)]
# Ids made on the device (D-08): uuids, or short readable ones for seed data.
ClientId = Annotated[str, Field(min_length=1, max_length=64)]

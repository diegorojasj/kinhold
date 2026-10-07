from typing import Annotated, Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import AfterValidator, Field

from common.sync import ClientId, IsoDateTime, RecordSchema


def _check_timezone(value: str) -> str:
    try:
        ZoneInfo(value)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        msg = f"unknown timezone {value!r}"
        raise ValueError(msg) from exc
    return value


Timezone = Annotated[str, Field(max_length=64), AfterValidator(_check_timezone)]
Currency = Annotated[str, Field(pattern=r"^[A-Z]{3}$")]
Color = Annotated[str, Field(pattern=r"^#[0-9a-fA-F]{6}$")]
Emoji = Annotated[str, Field(max_length=16)]
MemberName = Annotated[str, Field(min_length=1, max_length=60)]
Role = Literal["owner", "member"]


class HouseholdRecord(RecordSchema):
    name: Annotated[str, Field(min_length=1, max_length=80)]
    emoji: Emoji = "🏠"
    currency: Currency
    timezone: Timezone
    created_at: IsoDateTime


class MemberRecord(RecordSchema):
    name: MemberName
    color: Color
    role: Role = "member"
    joined_at: IsoDateTime


class ActivityRecord(RecordSchema):
    actor: ClientId
    type: Annotated[str, Field(min_length=1, max_length=40)]
    # Values for the message template: name, amount (cents), count, to…
    payload: Annotated[dict[str, str | int | float | None], Field(max_length=10, default_factory=dict)]
    at: IsoDateTime

from datetime import date
from typing import Annotated, Literal

from pydantic import Field

from common.sync import ClientId, IsoDateTime, RecordSchema, RRule


class ChoreRecord(RecordSchema):
    title: Annotated[str, Field(min_length=1, max_length=120)]
    emoji: Annotated[str, Field(max_length=16)] = ""
    rrule: RRule
    dtstart: date
    assignee_mode: Literal["fixed", "rotate"] = "fixed"
    assignees: Annotated[list[ClientId], Field(max_length=20, default_factory=list)]
    rotation_index: Annotated[int, Field(ge=0)] = 0
    next_due: date
    created_at: IsoDateTime


class ChoreEventRecord(RecordSchema):
    chore_id: ClientId
    user_id: ClientId
    action: Literal["done", "skip"]
    due_at: date
    day: date
    at: IsoDateTime

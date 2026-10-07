from pydantic import Field

from common.sync import ClientId, IsoDateTime
from common.sync.schemas import WireModel

from .records import Color, Currency, Emoji, MemberName, Timezone


class DeviceOut(WireModel):
    device_id: str
    token: str


class NewHousehold(WireModel):
    id: ClientId
    name: str = Field(min_length=1, max_length=80)
    emoji: Emoji = "🏠"
    currency: Currency
    timezone: Timezone
    created_at: IsoDateTime


class NewMemberIn(WireModel):
    id: ClientId
    name: MemberName
    color: Color


class CreateHouseholdIn(WireModel):
    household: NewHousehold
    member: NewMemberIn


class JoinedOut(WireModel):
    household_id: str
    member_id: str


class InviteOut(WireModel):
    code: str
    expires_at: IsoDateTime


class PreviewMember(WireModel):
    id: str
    name: str
    color: str
    # Already used on at least one device (the same person can still join on another one).
    linked: bool


class InvitePreviewOut(WireModel):
    household_id: str
    name: str
    emoji: str
    members: list[PreviewMember]
    expires_at: IsoDateTime


class AcceptIn(WireModel):
    """Join as someone already in the household (`member_id`) or as a new person (`member`)."""

    member_id: ClientId | None = None
    member: NewMemberIn | None = None

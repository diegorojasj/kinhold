import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from django.db import transaction

from common.auth import Actor
from common.errors import ApiError
from common.sync.engine import apply_ops, lock_household, now_ms
from common.sync.schemas import Op

from ..models import Household, Invite, Member, Membership
from ..schemas import (
    AcceptIn,
    CreateHouseholdIn,
    InviteOut,
    InvitePreviewOut,
    JoinedOut,
    NewMemberIn,
    PreviewMember,
)
from ..synced import BY_NAME
from .devices import active_member

INVITE_DAYS = 7
# No 0/O or 1/I, so a code read aloud or typed on a phone keyboard comes out right.
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 8


def _write(household_id: str, ops: list[Op]) -> int | None:
    """Trusted server-side write through the sync engine, so devices receive it like any other change."""
    out, cursor = apply_ops(BY_NAME, None, household_id, ops)
    rejected = [r for r in out.results if r.status != "ok"]
    if rejected:
        raise ApiError(422, "invalid", rejected[0].message or "Invalid record.")
    return cursor


def _op(collection: str, record_id: str, ts: int, fields: dict[str, Any]) -> Op:
    return Op(op_id=uuid.uuid4().hex, collection=collection, id=record_id, ts=ts, fields={**fields, "deleted": False})


def _member_fields(member: NewMemberIn, role: str) -> dict[str, Any]:
    return {"name": member.name, "color": member.color, "role": role, "joinedAt": datetime.now(UTC).isoformat()}


def create_household(device_id: str, body: CreateHouseholdIn) -> tuple[JoinedOut, int | None]:
    """
    A2: registers a household the device created (possibly offline, with its own id) and makes the device
    its owner. Written at ts 0, so the device's own queued ops for these records still win. Idempotent.
    """
    h = body.household
    with transaction.atomic():
        lock_household(h.id)
        if Household.objects.filter(household_id=h.id).exists():
            member_id = active_member(device_id, h.id)
            if member_id is None:
                raise ApiError(409, "household_exists", "A household with this id already exists.")
            return JoinedOut(household_id=h.id, member_id=member_id), None
        details = h.model_dump(mode="json", by_alias=True, exclude={"id"})
        cursor = _write(
            h.id,
            [
                _op("households", h.id, 0, details),
                _op("members", body.member.id, 0, _member_fields(body.member, "owner")),
            ],
        )
        Membership.objects.create(device_id=device_id, household_id=h.id, member_id=body.member.id)
    return JoinedOut(household_id=h.id, member_id=body.member.id), cursor


def create_invite(actor: Actor, household_id: str) -> InviteOut:
    code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))
    expires = datetime.now(UTC) + timedelta(days=INVITE_DAYS)
    Invite.objects.create(code=code, household_id=household_id, created_by=actor.member_id, expires_at=expires)
    return InviteOut(code=code, expires_at=expires)


def _usable_invite(code: str, device_id: str | None, *, lock: bool = False) -> Invite:
    rows = Invite.objects.select_for_update() if lock else Invite.objects
    invite = rows.filter(code=code.strip().upper().replace("-", "")).first()
    if invite is None:
        raise ApiError(404, "invite_not_found", "This invite code doesn't exist.")
    if invite.expires_at <= datetime.now(UTC):
        raise ApiError(410, "invite_expired", "This invite has expired.")
    if invite.used_at is not None and invite.used_by_id != device_id:
        raise ApiError(410, "invite_used", "This invite has already been used.")
    return invite


def preview_invite(code: str, device_id: str) -> InvitePreviewOut:
    """What the joining device shows before accepting: the household and who's in it."""
    invite = _usable_invite(code, device_id)
    hid = invite.household_id
    household = Household.objects.filter(household_id=hid, record_id=hid).first()
    if household is None:
        raise ApiError(404, "invite_not_found", "This invite's household no longer exists.")
    linked = set(Membership.objects.filter(household_id=hid).values_list("member_id", flat=True))
    members = Member.objects.filter(household_id=hid, deleted=False).order_by("joined_at")
    return InvitePreviewOut(
        household_id=hid,
        name=household.name,
        emoji=household.emoji,
        members=[
            PreviewMember(id=m.record_id, name=m.name, color=m.color, linked=m.record_id in linked) for m in members
        ],
        expires_at=invite.expires_at,
    )


def accept_invite(device_id: str, code: str, body: AcceptIn) -> tuple[JoinedOut, int | None]:
    """A3: joins the household as an existing member (e.g. one added by name) or as a new one."""
    with transaction.atomic():
        invite = _usable_invite(code, device_id, lock=True)
        hid = invite.household_id
        lock_household(hid)
        mine = Membership.objects.filter(device_id=device_id, household_id=hid).first()
        if mine is not None:
            return JoinedOut(household_id=hid, member_id=mine.member_id), None

        ts = now_ms()
        ops: list[Op] = []
        if body.member_id:
            if not Member.objects.filter(household_id=hid, record_id=body.member_id, deleted=False).exists():
                raise ApiError(404, "member_not_found", "That person is no longer in the household.")
            member_id = body.member_id
        elif body.member:
            if Member.objects.filter(household_id=hid, record_id=body.member.id).exists():
                raise ApiError(409, "member_exists", "A member with this id already exists.")
            member_id = body.member.id
            ops.append(_op("members", member_id, ts, _member_fields(body.member, "member")))
        else:
            raise ApiError(422, "invalid", "Choose who you are, or give a name.")
        joined = {"actor": member_id, "type": "member.joined", "payload": {}, "at": datetime.now(UTC).isoformat()}
        ops.append(_op("activity", uuid.uuid4().hex, ts, joined))
        cursor = _write(hid, ops)
        Membership.objects.create(device_id=device_id, household_id=hid, member_id=member_id)
        invite.used_at = datetime.now(UTC)
        invite.used_by_id = device_id
        invite.save(update_fields=["used_at", "used_by"])
    return JoinedOut(household_id=hid, member_id=member_id), cursor


def leave_household(actor: Actor, household_id: str) -> None:
    """The device stops syncing the household. The member stays (expenses still refer to them)."""
    Membership.objects.filter(device_id=actor.device_id, household_id=household_id).delete()

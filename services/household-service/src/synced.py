from typing import Any

from common.auth import Actor
from common.sync import Collection, RejectedError

from .models import Activity, Household, Member
from .schemas import ActivityRecord, HouseholdRecord, MemberRecord


def _role(household_id: str, member_id: str | None) -> str | None:
    rows = Member.objects.filter(household_id=household_id, record_id=member_id, deleted=False)
    return rows.values_list("role", flat=True).first()


def authorize_household(_actor: Actor, row: Household | None, fields: dict[str, Any]) -> None:
    """Any member can edit the details; creating goes through POST /households and nobody deletes one."""
    if row is None:
        msg = "Households are created with POST /households."
        raise RejectedError(msg)
    if fields.get("deleted"):
        msg = "A household can't be deleted; leave it instead."
        raise RejectedError(msg)


def authorize_member(actor: Actor, row: Member | None, fields: dict[str, Any]) -> None:
    """Anyone adds people by name or edits their own profile; the owner manages everyone else."""
    owner = _role(actor.household_id or "", actor.member_id) == "owner"
    if row is None:
        if fields.get("role", "member") != "member" and not owner:
            msg = "Only an owner can add another owner."
            raise RejectedError(msg)
        return
    is_self = row.record_id == actor.member_id
    if fields.get("deleted") and (is_self or not owner):
        msg = "Only an owner can remove someone, and not themselves."
        raise RejectedError(msg)
    if not is_self and not owner:
        msg = "Only an owner can change other members."
        raise RejectedError(msg)
    if "role" in fields and fields["role"] != row.role and not owner:
        msg = "Only an owner can change roles."
        raise RejectedError(msg)


COLLECTIONS = [
    Collection("households", Household, HouseholdRecord, authorize=authorize_household),
    Collection("members", Member, MemberRecord, authorize=authorize_member),
    # Devices keep the last 50 events (F3); the server keeps the same, so new devices don't download years of feed.
    Collection("activity", Activity, ActivityRecord, retain=("at", 50)),
]
BY_NAME = {c.name: c for c in COLLECTIONS}

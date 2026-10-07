import hashlib
import re
import secrets
import uuid
from dataclasses import dataclass

from common.errors import ApiError

from ..models import Device, Member, Membership
from ..schemas import DeviceOut

# Household routes on every service look like /api/<service>/households/<id>/...
HOUSEHOLD_IN_PATH = re.compile(r"^/api/[a-z]+/households/([^/?#]+)")


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def register_device() -> DeviceOut:
    token = secrets.token_urlsafe(32)
    device = Device.objects.create(id=uuid.uuid4().hex, token_hash=hash_token(token))
    return DeviceOut(device_id=device.id, token=token)


@dataclass(frozen=True)
class Identity:
    device_id: str
    household_id: str | None = None
    member_id: str | None = None


def verify(authorization: str, uri: str) -> Identity:
    """
    The gateway's forward_auth check for every protected request: a valid device token and, when the
    path names a household, a membership in it.
    """
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise ApiError(401, "unauthorized", "Missing device token.")
    device_id = Device.objects.filter(token_hash=hash_token(token)).values_list("id", flat=True).first()
    if device_id is None:
        raise ApiError(401, "unauthorized", "Unknown device token.")
    match = HOUSEHOLD_IN_PATH.match(uri)
    if match is None:
        return Identity(device_id)
    household_id = match.group(1)
    member_id = active_member(device_id, household_id)
    if member_id is None:
        raise ApiError(403, "not_a_member", "This device is not a member of the household.")
    return Identity(device_id, household_id, member_id)


def active_member(device_id: str, household_id: str) -> str | None:
    """The member this device acts as, unless an owner removed that member (an undo gives access back)."""
    member_id = (
        Membership.objects.filter(device_id=device_id, household_id=household_id)
        .values_list("member_id", flat=True)
        .first()
    )
    if member_id is None:
        return None
    removed = not Member.objects.filter(household_id=household_id, record_id=member_id, deleted=False).exists()
    return None if removed else member_id


def household_ids(device_id: str) -> list[str]:
    return list(Membership.objects.filter(device_id=device_id).values_list("household_id", flat=True))

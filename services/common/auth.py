from dataclasses import dataclass

from django.conf import settings
from django.http import HttpRequest
from django.utils.crypto import constant_time_compare
from ninja.security import APIKeyHeader

from .errors import ApiError

# Set by the gateway after its forward_auth call to household-service (see containers/gateway/Caddyfile).
GATEWAY_HEADER = "X-Kinhold-Gateway"
DEVICE_HEADER = "X-Kinhold-Device"
HOUSEHOLD_HEADER = "X-Kinhold-Household"
MEMBER_HEADER = "X-Kinhold-Member"


@dataclass(frozen=True)
class Actor:
    """Who is calling: a registered device and, on household routes, the member it acts as."""

    device_id: str
    household_id: str | None = None
    member_id: str | None = None


class GatewayAuth(APIKeyHeader):
    """Trusts the identity headers added by the gateway, but only when the gateway secret is present."""

    param_name = DEVICE_HEADER

    def authenticate(self, request: HttpRequest, key: str | None) -> Actor | None:
        if not constant_time_compare(request.headers.get(GATEWAY_HEADER, ""), settings.GATEWAY_SECRET):
            return None
        if not key:
            return None
        return Actor(
            device_id=key,
            household_id=request.headers.get(HOUSEHOLD_HEADER) or None,
            member_id=request.headers.get(MEMBER_HEADER) or None,
        )


def member_of(request: HttpRequest, household_id: str) -> Actor:
    """The caller as a member of `household_id`; the gateway checked membership for this exact household."""
    actor: Actor = request.auth  # type: ignore[attr-defined]
    if actor.household_id != household_id or not actor.member_id:
        raise ApiError(403, "not_a_member", "This device is not a member of the household.")
    return actor

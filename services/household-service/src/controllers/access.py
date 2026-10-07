from asgiref.sync import sync_to_async
from django.conf import settings
from django.http import HttpRequest, HttpResponse
from django.utils.crypto import constant_time_compare
from ninja import Router, Status

from common.auth import DEVICE_HEADER, GATEWAY_HEADER, HOUSEHOLD_HEADER, MEMBER_HEADER, Actor, GatewayAuth, member_of
from common.errors import ApiError
from common.events import publish_change

from ..schemas import AcceptIn, CreateHouseholdIn, DeviceOut, InviteOut, InvitePreviewOut, JoinedOut
from ..services import devices, households

SERVICE = "household"
router = Router(tags=["access"])


@router.post("/devices", auth=None, response={201: DeviceOut}, by_alias=True)
async def register_device(request: HttpRequest) -> Status[DeviceOut]:  # noqa: ARG001
    """A new install gets an id and a secret token. No account: households are joined with invite codes."""
    return Status(201, await sync_to_async(devices.register_device)())


@router.get("/auth/verify", auth=None, include_in_schema=False)
async def verify(request: HttpRequest) -> HttpResponse:
    """Called by the gateway (Caddy forward_auth) before every protected request; its headers go upstream."""
    if not constant_time_compare(request.headers.get(GATEWAY_HEADER, ""), settings.GATEWAY_SECRET):
        raise ApiError(403, "forbidden", "Gateway only.")
    identity = await sync_to_async(devices.verify)(
        request.headers.get("Authorization", ""), request.headers.get("X-Forwarded-Uri", "")
    )
    response = HttpResponse(status=204)
    response[DEVICE_HEADER] = identity.device_id
    if identity.household_id and identity.member_id:
        response[HOUSEHOLD_HEADER] = identity.household_id
        response[MEMBER_HEADER] = identity.member_id
    return response


@router.post("/households", auth=GatewayAuth(), response=JoinedOut, by_alias=True)
async def create_household(request: HttpRequest, body: CreateHouseholdIn) -> JoinedOut:
    actor: Actor = request.auth  # type: ignore[attr-defined]
    joined, cursor = await sync_to_async(households.create_household)(actor.device_id, body)
    if cursor is not None:
        await publish_change(joined.household_id, SERVICE, cursor)
    return joined


@router.post("/households/{household_id}/invites", auth=GatewayAuth(), response={201: InviteOut}, by_alias=True)
async def create_invite(request: HttpRequest, household_id: str) -> Status[InviteOut]:
    actor = member_of(request, household_id)
    return Status(201, await sync_to_async(households.create_invite)(actor, household_id))


@router.delete("/households/{household_id}/membership", auth=GatewayAuth(), response={204: None})
async def leave_household(request: HttpRequest, household_id: str) -> Status[None]:
    actor = member_of(request, household_id)
    await sync_to_async(households.leave_household)(actor, household_id)
    return Status(204, None)


@router.get("/invites/{code}", auth=GatewayAuth(), response=InvitePreviewOut, by_alias=True)
async def preview_invite(request: HttpRequest, code: str) -> InvitePreviewOut:
    actor: Actor = request.auth  # type: ignore[attr-defined]
    return await sync_to_async(households.preview_invite)(code, actor.device_id)


@router.post("/invites/{code}/accept", auth=GatewayAuth(), response=JoinedOut, by_alias=True)
async def accept_invite(request: HttpRequest, code: str, body: AcceptIn) -> JoinedOut:
    actor: Actor = request.auth  # type: ignore[attr-defined]
    joined, cursor = await sync_to_async(households.accept_invite)(actor.device_id, code, body)
    if cursor is not None:
        await publish_change(joined.household_id, SERVICE, cursor)
    return joined

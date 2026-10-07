"""
Server-sent events (D-05): one stream per device for all its households. Each message only says
"service X of household H changed up to cursor N"; the device then pulls from X. After a reconnect the
device pulls everything since its cursors, so nothing sent while it was offline is lost.
"""

import asyncio
import json
import time
from collections.abc import AsyncIterator

from asgiref.sync import sync_to_async
from django.http import HttpRequest, StreamingHttpResponse
from ninja import Router
from valkey.asyncio import Valkey
from valkey.asyncio.client import PubSub
from valkey.exceptions import ValkeyError

from common.auth import Actor, GatewayAuth
from common.errors import ApiError
from common.events import household_channel, valkey_client

from ..services.devices import household_ids

router = Router(tags=["live"])

HEARTBEAT_SECONDS = 20
# Streams end after a while so devices reconnect and pick up households they joined meanwhile.
MAX_STREAM_SECONDS = 15 * 60


def _event(name: str, data: object) -> str:
    return f"event: {name}\ndata: {json.dumps(data)}\n\n"


async def _stream(client: Valkey, pubsub: PubSub | None, households: list[str]) -> AsyncIterator[str]:
    try:
        # Reconnect delay for clients using EventSource; the app's own client has its own backoff.
        yield "retry: 3000\n"
        # Subscribed already, so the device can pull now without missing a change in between.
        yield _event("ready", {"households": households})
        until = time.monotonic() + MAX_STREAM_SECONDS
        while time.monotonic() < until:
            message = await pubsub.get_message(True, HEARTBEAT_SECONDS) if pubsub else None  # noqa: FBT003
            if message is None:
                if pubsub is None:
                    await asyncio.sleep(HEARTBEAT_SECONDS)
                yield ": ping\n\n"
                continue
            yield _event("change", json.loads(message["data"]))
    finally:
        if pubsub is not None:
            await pubsub.aclose()
        await client.aclose()


@router.get("/events", auth=GatewayAuth())
async def events(request: HttpRequest) -> StreamingHttpResponse:
    actor: Actor = request.auth  # type: ignore[attr-defined]
    households = await sync_to_async(household_ids)(actor.device_id)
    client = valkey_client()
    pubsub: PubSub | None = None
    try:
        if households:
            pubsub = client.pubsub()
            await pubsub.subscribe(*(household_channel(h) for h in households))
    except (ValkeyError, OSError) as exc:
        await client.aclose()
        raise ApiError(503, "live_unavailable", "Live updates are unavailable; the app falls back to polling.") from exc
    response = StreamingHttpResponse(_stream(client, pubsub, households), content_type="text/event-stream")
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"  # nginx: don't buffer the stream
    return response

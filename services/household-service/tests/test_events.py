import asyncio
import json

import pytest
from asgiref.sync import sync_to_async
from django.db import connections
from django.test import AsyncClient
from src.models import Device, Membership

from common.events import publish_change, valkey_ok
from common.testing import gateway_headers


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_stream_relays_changes_of_the_devices_households() -> None:
    if not await valkey_ok():
        pytest.skip("Valkey is not running")
    await sync_to_async(Device.objects.create)(id="dev-1", token_hash="x" * 64)
    await sync_to_async(Membership.objects.create)(device_id="dev-1", household_id="hh-1", member_id="ana")

    res = await AsyncClient().get("/api/household/events", headers=gateway_headers("dev-1"))
    assert res.status_code == 200
    assert res["Content-Type"] == "text/event-stream"
    chunks = aiter(res.streaming_content)

    async def next_event() -> str:
        while True:
            chunk = await asyncio.wait_for(anext(chunks), timeout=5)
            text = chunk.decode() if isinstance(chunk, bytes) else chunk
            if text.startswith("event:"):
                return text

    assert json.loads((await next_event()).split("data: ")[1]) == {"households": ["hh-1"]}
    await publish_change("hh-2", "shopping", 7)  # someone else's household: not relayed
    await publish_change("hh-1", "shopping", 8)
    change = await next_event()
    assert change.startswith("event: change")
    assert json.loads(change.split("data: ")[1]) == {"householdId": "hh-1", "service": "shopping", "cursor": 8}
    await chunks.aclose()
    await sync_to_async(connections.close_all)()

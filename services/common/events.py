"""
Live updates (D-04/D-05). A write publishes "service X of household H is now at cursor N" on the
household's Valkey channel; household-service relays it to devices over SSE and they pull from X.
The pull is what catches a device up after it was offline, so a lost message only costs latency.
"""

import json
import logging

from django.conf import settings
from valkey.asyncio import Valkey
from valkey.exceptions import ValkeyError

logger = logging.getLogger(__name__)


def household_channel(household_id: str) -> str:
    return f"hh:{household_id}"


def valkey_client() -> Valkey:
    return Valkey.from_url(settings.VALKEY_URL, socket_connect_timeout=2)


async def publish_change(household_id: str, service: str, cursor: int) -> None:
    payload = json.dumps({"householdId": household_id, "service": service, "cursor": cursor})
    try:
        async with valkey_client() as client:
            await client.publish(household_channel(household_id), payload)
    except (ValkeyError, OSError):
        # Devices still converge through their periodic and on-reconnect pulls.
        logger.warning("Could not publish change for household %s", household_id, exc_info=True)


async def valkey_ok() -> bool:
    try:
        async with valkey_client() as client:
            return bool(await client.ping())
    except (ValkeyError, OSError):
        return False

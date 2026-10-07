"""Helpers for service tests: requests that look like they came through the gateway."""

from typing import Any

from django.conf import settings

from .auth import DEVICE_HEADER, GATEWAY_HEADER, HOUSEHOLD_HEADER, MEMBER_HEADER


def gateway_headers(device: str = "dev-1", household: str | None = None, member: str | None = None) -> dict[str, str]:
    headers = {GATEWAY_HEADER: settings.GATEWAY_SECRET, DEVICE_HEADER: device}
    if household:
        headers[HOUSEHOLD_HEADER] = household
    if member:
        headers[MEMBER_HEADER] = member
    return headers


def op(collection: str, record_id: str, ts: int, **fields: Any) -> dict[str, Any]:
    return {
        "opId": f"{collection}:{record_id}:{ts}",
        "collection": collection,
        "id": record_id,
        "ts": ts,
        "fields": fields,
    }

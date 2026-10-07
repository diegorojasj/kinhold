from typing import Any

from django.conf import settings
from django.test import Client

from common.testing import gateway_headers

NOW = "2026-10-06T10:00:00.000Z"


def register(client: Client) -> dict[str, str]:
    res = client.post("/api/household/devices")
    assert res.status_code == 201, res.content
    return res.json()


def verify(client: Client, token: str | None, uri: str) -> Any:
    headers = {"X-Kinhold-Gateway": settings.GATEWAY_SECRET, "X-Forwarded-Uri": uri}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return client.get("/api/household/auth/verify", headers=headers)


def create_household(client: Client, device_id: str, hid: str = "hh-1", member: str = "ana") -> Any:
    body = {
        "household": {"id": hid, "name": "Our flat", "emoji": "🏡", "currency": "EUR",
                      "timezone": "Europe/Madrid", "createdAt": NOW},
        "member": {"id": member, "name": "Ana", "color": "#6a55d6"},
    }  # fmt: skip
    return client.post(
        "/api/household/households", body, content_type="application/json", headers=gateway_headers(device_id)
    )


def as_member(device_id: str, hid: str, member: str) -> dict[str, str]:
    return gateway_headers(device_id, household=hid, member=member)

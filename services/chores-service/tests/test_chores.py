from typing import Any

import pytest
from django.test import Client

from common.testing import gateway_headers, op

pytestmark = pytest.mark.django_db

HH = "hh-1"
URL = f"/api/chores/households/{HH}/sync"
HEADERS = gateway_headers(household=HH, member="ana")


def chore(**overrides: Any) -> dict[str, Any]:
    return {
        "title": "Take out the trash",
        "emoji": "🗑️",
        "rrule": "FREQ=WEEKLY;BYDAY=MO,TH",
        "dtstart": "2026-09-01",
        "assigneeMode": "rotate",
        "assignees": ["ana", "ben"],
        "rotationIndex": 0,
        "nextDue": "2026-10-06",
        "createdAt": "2026-09-01T08:00:00.000Z",
        "deleted": False,
    } | overrides


def push(client: Client, *ops: dict[str, Any]) -> list[dict[str, Any]]:
    res = client.post(URL, {"ops": list(ops)}, content_type="application/json", headers=HEADERS)
    assert res.status_code == 200, res.content
    return res.json()["results"]


def test_complete_advances_rotation_and_records_history(client: Client) -> None:
    push(client, op("chores", "c-1", 1, **chore()))
    event = {"choreId": "c-1", "userId": "ana", "action": "done", "dueAt": "2026-10-06", "day": "2026-10-06",
             "at": "2026-10-06T19:00:00.000Z", "deleted": False}  # fmt: skip
    results = push(
        client, op("chores", "c-1", 2, nextDue="2026-10-09", rotationIndex=1), op("events", "ev-1", 2, **event)
    )
    assert [r["status"] for r in results] == ["ok", "ok"]
    changes = client.get(URL, headers=HEADERS).json()["changes"]
    by_id = {c["record"]["id"]: c["record"] for c in changes}
    assert by_id["c-1"]["nextDue"] == "2026-10-09"
    assert by_id["c-1"]["rotationIndex"] == 1
    assert by_id["ev-1"]["action"] == "done"


@pytest.mark.parametrize(
    "rrule", ["FREQ=MONTHLY;BYMONTHDAY=-1", "FREQ=WEEKLY;INTERVAL=2;BYDAY=TU", "FREQ=DAILY;INTERVAL=3"]
)
def test_accepts_the_repeat_rules_the_app_makes(client: Client, rrule: str) -> None:
    assert push(client, op("chores", "c-1", 1, **chore(rrule=rrule)))[0]["status"] == "ok"


def test_rejects_a_broken_rrule(client: Client) -> None:
    [result] = push(client, op("chores", "c-1", 1, **chore(rrule="FREQ=SOMETIMES")))
    assert result["code"] == "invalid"
    assert "rrule" in result["message"]

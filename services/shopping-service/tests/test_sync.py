"""The shared sync engine (common/sync), exercised through the shopping service."""

from typing import Any

import pytest
from django.test import Client

from common.testing import gateway_headers, op

pytestmark = pytest.mark.django_db

HH = "hh-1"
URL = f"/api/shopping/households/{HH}/sync"
AS_MEMBER = gateway_headers(household=HH, member="m-1")


def item(**overrides: Any) -> dict[str, Any]:
    return {
        "name": "Milk",
        "qty": "2",
        "note": "",
        "category": "dairy",
        "checked": False,
        "addedBy": "m-1",
        "createdAt": "2026-10-06T10:00:00.000Z",
        "updatedAt": "2026-10-06T10:00:00.000Z",
        "deleted": False,
    } | overrides


def push(client: Client, *ops: dict[str, Any]) -> dict[str, Any]:
    res = client.post(URL, {"ops": list(ops)}, content_type="application/json", headers=AS_MEMBER)
    assert res.status_code == 200, res.content
    return res.json()


def pull(client: Client, since: int = 0, **params: Any) -> dict[str, Any]:
    res = client.get(URL, {"since": since, **params}, headers=AS_MEMBER)
    assert res.status_code == 200, res.content
    return res.json()


def records(client: Client, since: int = 0) -> dict[str, dict[str, Any]]:
    return {c["record"]["id"]: c["record"] for c in pull(client, since)["changes"]}


def test_pushed_record_comes_back_in_camel_case(client: Client) -> None:
    out = push(client, op("items", "i-1", 1000, **item()))
    assert out["results"] == [{"opId": "items:i-1:1000", "status": "ok", "code": None, "message": None, "record": None}]
    rec = records(client)["i-1"]
    assert rec["householdId"] == HH
    assert rec["addedBy"] == "m-1"
    assert rec["createdAt"] == "2026-10-06T10:00:00.000Z"
    assert rec["checkedBy"] is None
    assert rec["deleted"] is False


def test_last_write_wins_per_field(client: Client) -> None:
    push(client, op("items", "i-1", 1000, **item()))
    # Two phones edit different fields offline; the older one syncs last.
    push(client, op("items", "i-1", 3000, checked=True, checkedBy="m-2"))
    push(client, op("items", "i-1", 2000, qty="5", checked=False))
    rec = records(client)["i-1"]
    assert rec["qty"] == "5"  # nobody newer touched qty
    assert rec["checked"] is True  # the newer tick wins over the older untick
    assert rec["checkedBy"] == "m-2"


def test_retrying_an_op_changes_nothing(client: Client) -> None:
    first = op("items", "i-1", 1000, **item())
    push(client, first)
    cursor = pull(client)["cursor"]
    push(client, first)
    assert pull(client, cursor)["changes"] == []


def test_delete_is_a_tombstone_and_undo_restores(client: Client) -> None:
    push(client, op("items", "i-1", 1000, **item()))
    cursor = pull(client)["cursor"]
    push(client, op("items", "i-1", 2000, deleted=True))
    assert records(client, cursor)["i-1"] == {"id": "i-1", "householdId": HH, "deleted": True}

    push(client, op("items", "i-1", 1500, qty="9"))  # an edit made before the delete stays deleted
    assert records(client)["i-1"]["deleted"] is True

    push(client, op("items", "i-1", 4000, **item(qty="3")))  # undo: the whole record again, newer
    rec = records(client)["i-1"]
    assert rec["deleted"] is False
    assert rec["qty"] == "3"


def test_invalid_op_is_rejected_with_the_server_record(client: Client) -> None:
    push(client, op("items", "i-1", 1000, **item()))
    out = push(client, op("items", "i-1", 2000, category="spaceship"), op("items", "i-2", 2000, qty="1"))
    bad_category, incomplete = out["results"]
    assert bad_category["status"] == "rejected"
    assert bad_category["code"] == "invalid"
    assert bad_category["record"]["category"] == "dairy"
    assert incomplete["status"] == "rejected"  # an update for a record the server never had
    assert incomplete["record"] is None
    assert records(client)["i-1"]["category"] == "dairy"


def test_unknown_fields_are_ignored(client: Client) -> None:
    out = push(client, op("items", "i-1", 1000, **item(), shinyNewField=1))
    assert out["results"][0]["status"] == "ok"


def test_pull_pages_through_changes_in_seq_order(client: Client) -> None:
    for n in range(5):
        push(client, op("items", f"i-{n}", 1000 + n, **item(name=f"Thing {n}")))
    push(
        client,
        op("catalog", "c-1", 9000, name="Milk", category="dairy", timesAdded=3, lastAddedAt="2026-10-06T10:00:00Z"),
    )
    seen: list[str] = []
    since, more = 0, True
    while more:
        page = pull(client, since, limit=2)
        seen += [c["record"]["id"] for c in page["changes"]]
        since, more = page["cursor"], page["more"]
    assert seen == ["i-0", "i-1", "i-2", "i-3", "i-4", "c-1"]


def test_cursor_ahead_of_server_asks_for_reset(client: Client) -> None:
    push(client, op("items", "i-1", 1000, **item()))
    page = pull(client, since=10**9)
    assert page["reset"] is True
    assert page["cursor"] == 0


def test_households_are_isolated(client: Client) -> None:
    push(client, op("items", "i-1", 1000, **item()))
    other = gateway_headers(household="hh-2", member="m-9")
    res = client.get("/api/shopping/households/hh-2/sync", headers=other)
    assert res.json()["changes"] == []


def test_requires_the_gateway(client: Client) -> None:
    no_secret = {k: v for k, v in AS_MEMBER.items() if k != "X-Kinhold-Gateway"}
    assert client.get(URL, headers=no_secret).status_code == 401
    assert client.get(URL, headers={**AS_MEMBER, "X-Kinhold-Gateway": "guess"}).status_code == 401


def test_membership_is_checked_for_the_household_in_the_path(client: Client) -> None:
    res = client.get(URL, headers=gateway_headers(household="hh-2", member="m-1"))
    assert res.status_code == 403
    assert res.json()["code"] == "not_a_member"


def test_health(client: Client) -> None:
    res = client.get("/api/shopping/health")
    assert res.status_code == 200
    assert res.json()["database"] is True

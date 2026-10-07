from typing import Any

import pytest
from django.test import Client

from common.testing import gateway_headers, op

pytestmark = pytest.mark.django_db

HH = "hh-1"
URL = f"/api/money/households/{HH}/sync"
NOW = "2026-10-06T10:00:00.000Z"


def expense(**overrides: Any) -> dict[str, Any]:
    return {
        "description": "Groceries",
        "amountCents": 1001,
        "paidBy": "ana",
        "date": "2026-10-06",
        "category": "groceries",
        "splitMode": "equal",
        "splitInput": {"ana": 1, "ben": 1},
        "splits": [{"userId": "ana", "amountCents": 501}, {"userId": "ben", "amountCents": 500}],
        "createdBy": "ana",
        "createdAt": NOW,
        "updatedAt": NOW,
        "deleted": False,
    } | overrides


def push(client: Client, member: str, *ops: dict[str, Any]) -> list[dict[str, Any]]:
    headers = gateway_headers(household=HH, member=member)
    res = client.post(URL, {"ops": list(ops)}, content_type="application/json", headers=headers)
    assert res.status_code == 200, res.content
    return res.json()["results"]


def test_expense_round_trips_with_nested_splits(client: Client) -> None:
    assert push(client, "ana", op("expenses", "e-1", 1, **expense()))[0]["status"] == "ok"
    res = client.get(URL, headers=gateway_headers(household=HH, member="ben"))
    rec = res.json()["changes"][0]["record"]
    assert rec["splits"] == [{"userId": "ana", "amountCents": 501}, {"userId": "ben", "amountCents": 500}]
    assert rec["splitInput"] == {"ana": 1.0, "ben": 1.0}


def test_splits_must_add_up_to_the_total(client: Client) -> None:
    [result] = push(client, "ana", op("expenses", "e-1", 1, **expense(amountCents=2000)))
    assert result["status"] == "rejected"
    assert "add up" in result["message"]


def test_an_edit_that_breaks_the_total_is_rejected(client: Client) -> None:
    push(client, "ana", op("expenses", "e-1", 1, **expense()))
    [result] = push(client, "ana", op("expenses", "e-1", 2, amountCents=5000))
    assert result["code"] == "invalid"
    assert result["record"]["amountCents"] == 1001


def test_only_the_creator_can_edit_or_delete(client: Client) -> None:
    push(client, "ana", op("expenses", "e-1", 1, **expense()))
    [edit] = push(client, "ben", op("expenses", "e-1", 2, description="Mine now"))
    [delete] = push(client, "ben", op("expenses", "e-1", 3, deleted=True))
    assert (edit["code"], delete["code"]) == ("forbidden", "forbidden")
    assert push(client, "ana", op("expenses", "e-1", 4, deleted=True))[0]["status"] == "ok"


def test_cannot_create_an_expense_in_someone_elses_name(client: Client) -> None:
    [result] = push(client, "ben", op("expenses", "e-1", 1, **expense()))
    assert result["code"] == "forbidden"


def test_settlement_uses_from_and_to(client: Client) -> None:
    fields = {"from": "ben", "to": "ana", "amountCents": 500, "date": "2026-10-06", "createdAt": NOW, "deleted": False}
    assert push(client, "ben", op("settlements", "s-1", 1, **fields))[0]["status"] == "ok"
    rec = client.get(URL, headers=gateway_headers(household=HH, member="ana")).json()["changes"][0]["record"]
    assert (rec["from"], rec["to"]) == ("ben", "ana")
    assert push(client, "cy", op("settlements", "s-1", 2, deleted=True))[0]["code"] == "forbidden"
    assert push(client, "ana", op("settlements", "s-1", 3, deleted=True))[0]["status"] == "ok"

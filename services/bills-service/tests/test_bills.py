import pytest
from django.test import Client

from common.testing import gateway_headers, op

pytestmark = pytest.mark.django_db

HH = "hh-1"
URL = f"/api/bills/households/{HH}/sync"
HEADERS = gateway_headers(household=HH, member="ana")


def test_mark_paid_records_payment_and_moves_due_date(client: Client) -> None:
    bill = {"name": "Internet", "emoji": "📶", "amountCents": 3999, "rrule": "FREQ=MONTHLY;BYMONTHDAY=8",
            "dtstart": "2026-01-08", "nextDue": "2026-10-08", "remindDaysBefore": 3, "category": "utilities",
            "createdAt": "2026-01-01T00:00:00.000Z", "deleted": False}  # fmt: skip
    payment = {"billId": "b-1", "name": "Internet", "emoji": "📶", "amountCents": 4210, "dueDate": "2026-10-08",
               "paidAt": "2026-10-06", "paidBy": "ana", "expenseId": "e-9", "deleted": False}  # fmt: skip
    ops = [
        op("bills", "b-1", 1, **bill),
        op("bills", "b-1", 2, nextDue="2026-11-08", lastPaidAt="2026-10-06"),
        op("payments", "p-1", 2, **payment),
    ]
    res = client.post(URL, {"ops": ops}, content_type="application/json", headers=HEADERS)
    assert [r["status"] for r in res.json()["results"]] == ["ok", "ok", "ok"]
    by_id = {c["record"]["id"]: c["record"] for c in client.get(URL, headers=HEADERS).json()["changes"]}
    assert by_id["b-1"]["nextDue"] == "2026-11-08"
    assert by_id["b-1"]["lastPaidAt"] == "2026-10-06"
    assert by_id["p-1"]["expenseId"] == "e-9"

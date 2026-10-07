from datetime import UTC, datetime, timedelta

import pytest
from django.test import Client
from src.models import Invite, Membership

from common.testing import gateway_headers, op

from .helpers import as_member, create_household, register, verify

pytestmark = pytest.mark.django_db


def test_gateway_check_needs_a_valid_token(client: Client) -> None:
    device = register(client)
    assert verify(client, None, "/api/shopping/households/hh-1/sync").status_code == 401
    assert verify(client, "nope", "/api/shopping/households/hh-1/sync").status_code == 401
    ok = verify(client, device["token"], "/api/household/events")
    assert ok.status_code == 204
    assert ok["X-Kinhold-Device"] == device["deviceId"]
    assert "X-Kinhold-Member" not in ok


def test_gateway_check_needs_membership_of_the_household_in_the_path(client: Client) -> None:
    device = register(client)
    assert verify(client, device["token"], "/api/shopping/households/hh-1/sync").status_code == 403
    create_household(client, device["deviceId"])
    ok = verify(client, device["token"], "/api/shopping/households/hh-1/sync?since=4")
    assert ok.status_code == 204
    assert (ok["X-Kinhold-Household"], ok["X-Kinhold-Member"]) == ("hh-1", "ana")


def test_verify_is_only_for_the_gateway(client: Client) -> None:
    device = register(client)
    res = client.get("/api/household/auth/verify", headers={"Authorization": f"Bearer {device['token']}"})
    assert res.status_code == 403


def test_create_household_makes_the_device_its_owner(client: Client) -> None:
    device = register(client)
    res = create_household(client, device["deviceId"])
    assert res.json() == {"householdId": "hh-1", "memberId": "ana"}
    changes = client.get("/api/household/households/hh-1/sync", headers=as_member(device["deviceId"], "hh-1", "ana"))
    records = {c["record"]["id"]: c["record"] for c in changes.json()["changes"]}
    assert records["hh-1"]["timezone"] == "Europe/Madrid"
    assert records["ana"]["role"] == "owner"


def test_create_household_is_idempotent_but_ids_are_not_shared(client: Client) -> None:
    mine, other = register(client), register(client)
    create_household(client, mine["deviceId"])
    assert create_household(client, mine["deviceId"]).status_code == 200
    assert create_household(client, other["deviceId"]).status_code == 409


def test_invite_join_as_new_member(client: Client) -> None:
    owner, joiner = register(client), register(client)
    create_household(client, owner["deviceId"])
    invite = client.post("/api/household/households/hh-1/invites", headers=as_member(owner["deviceId"], "hh-1", "ana"))
    assert invite.status_code == 201
    code = invite.json()["code"]

    preview = client.get(f"/api/household/invites/{code.lower()}", headers=gateway_headers(joiner["deviceId"]))
    assert preview.json()["name"] == "Our flat"
    assert preview.json()["members"] == [{"id": "ana", "name": "Ana", "color": "#6a55d6", "linked": True}]

    body = {"member": {"id": "ben", "name": "Ben", "color": "#2f9a5c"}}
    url = f"/api/household/invites/{code}/accept"
    res = client.post(url, body, content_type="application/json", headers=gateway_headers(joiner["deviceId"]))
    assert res.json() == {"householdId": "hh-1", "memberId": "ben"}
    # Retrying is fine, using it from a third device is not (single use).
    assert (
        client.post(url, body, content_type="application/json", headers=gateway_headers(joiner["deviceId"])).status_code
        == 200
    )
    third = register(client)
    assert (
        client.post(url, body, content_type="application/json", headers=gateway_headers(third["deviceId"])).status_code
        == 410
    )

    feed = client.get("/api/household/households/hh-1/sync", headers=as_member(joiner["deviceId"], "hh-1", "ben"))
    types = [c["record"].get("type") for c in feed.json()["changes"] if c["collection"] == "activity"]
    assert types == ["member.joined"]


def test_invite_join_as_someone_added_by_name(client: Client) -> None:
    owner, laptop = register(client), register(client)
    create_household(client, owner["deviceId"])
    # Second device of the same person: joins as the existing member.
    code = client.post(
        "/api/household/households/hh-1/invites", headers=as_member(owner["deviceId"], "hh-1", "ana")
    ).json()["code"]
    res = client.post(
        f"/api/household/invites/{code}/accept", {"memberId": "ana"}, content_type="application/json",
        headers=gateway_headers(laptop["deviceId"]),
    )  # fmt: skip
    assert res.json()["memberId"] == "ana"
    assert Membership.objects.filter(household_id="hh-1", member_id="ana").count() == 2


def test_expired_invite(client: Client) -> None:
    owner = register(client)
    create_household(client, owner["deviceId"])
    Invite.objects.create(
        code="OLDCODE2", household_id="hh-1", created_by="ana", expires_at=datetime.now(UTC) - timedelta(seconds=1)
    )
    res = client.get("/api/household/invites/OLDCODE2", headers=gateway_headers(owner["deviceId"]))
    assert res.status_code == 410
    assert res.json()["code"] == "invite_expired"


def test_leave_stops_access(client: Client) -> None:
    device = register(client)
    create_household(client, device["deviceId"])
    res = client.delete(
        "/api/household/households/hh-1/membership", headers=as_member(device["deviceId"], "hh-1", "ana")
    )
    assert res.status_code == 204
    assert verify(client, device["token"], "/api/money/households/hh-1/sync").status_code == 403


def push(client: Client, device: str, member: str, *ops: dict) -> list[dict]:
    res = client.post(
        "/api/household/households/hh-1/sync", {"ops": list(ops)}, content_type="application/json",
        headers=as_member(device, "hh-1", member),
    )  # fmt: skip
    return res.json()["results"]


def test_member_rules(client: Client) -> None:
    device = register(client)
    create_household(client, device["deviceId"])
    sam = {"name": "Sam", "color": "#e0573f", "role": "member", "joinedAt": "2026-10-06T10:00:00Z", "deleted": False}
    assert push(client, device["deviceId"], "ana", op("members", "sam", 1, **sam))[0]["status"] == "ok"
    # Sam (a plain member) can edit their own profile but not rename others, promote themselves or remove anyone.
    assert push(client, "dev-sam", "sam", op("members", "sam", 2, name="Sammy"))[0]["status"] == "ok"
    assert push(client, "dev-sam", "sam", op("members", "ana", 3, name="Not Ana"))[0]["code"] == "forbidden"
    assert push(client, "dev-sam", "sam", op("members", "sam", 4, role="owner"))[0]["code"] == "forbidden"
    assert push(client, "dev-sam", "sam", op("members", "ana", 5, deleted=True))[0]["code"] == "forbidden"
    # The owner can.
    assert push(client, device["deviceId"], "ana", op("members", "sam", 6, deleted=True))[0]["status"] == "ok"


def test_households_are_edited_not_deleted(client: Client) -> None:
    device = register(client)
    create_household(client, device["deviceId"])
    assert push(client, device["deviceId"], "ana", op("households", "hh-1", 1, name="New name"))[0]["status"] == "ok"
    assert push(client, device["deviceId"], "ana", op("households", "hh-1", 2, deleted=True))[0]["code"] == "forbidden"
    assert (
        push(client, device["deviceId"], "ana", op("households", "hh-1", 3, timezone="Mars/Olympus"))[0]["code"]
        == "invalid"
    )


def test_activity_feed_keeps_the_last_50(client: Client) -> None:
    device = register(client)
    create_household(client, device["deviceId"])
    ops = [
        op("activity", f"a-{n}", n, actor="ana", type="item.added", payload={"name": "Milk"},
           at=f"2026-10-06T10:{n // 60:02d}:{n % 60:02d}.000Z", deleted=False)
        for n in range(60)
    ]  # fmt: skip
    push(client, device["deviceId"], "ana", *ops)
    from src.models import Activity  # noqa: PLC0415

    kept = set(Activity.objects.filter(household_id="hh-1").values_list("record_id", flat=True))
    assert kept == {f"a-{n}" for n in range(10, 60)}


def test_removing_a_member_cuts_off_their_devices(client: Client) -> None:
    owner, sams_phone = register(client), register(client)
    create_household(client, owner["deviceId"])
    code = client.post(
        "/api/household/households/hh-1/invites", headers=as_member(owner["deviceId"], "hh-1", "ana")
    ).json()["code"]
    body = {"member": {"id": "sam", "name": "Sam", "color": "#e0573f"}}
    client.post(
        f"/api/household/invites/{code}/accept", body, content_type="application/json",
        headers=gateway_headers(sams_phone["deviceId"]),
    )  # fmt: skip
    uri = "/api/chores/households/hh-1/sync"
    assert verify(client, sams_phone["token"], uri).status_code == 204

    push(client, owner["deviceId"], "ana", op("members", "sam", 2**42, deleted=True))
    assert verify(client, sams_phone["token"], uri).status_code == 403
    # Their app tries to register the household again: refused, so it stops syncing it.
    assert create_household(client, sams_phone["deviceId"]).status_code == 409

    push(client, owner["deviceId"], "ana", op("members", "sam", 2**43, deleted=False))  # undo
    assert verify(client, sams_phone["token"], uri).status_code == 204

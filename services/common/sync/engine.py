import time
from collections.abc import Mapping, Sequence
from typing import TYPE_CHECKING, Any

from django.db import connection, transaction
from pydantic import ValidationError

from ..auth import Actor
from .collection import Collection, RejectedError
from .schemas import Change, Op, OpResult, PullOut, PushOut

if TYPE_CHECKING:
    from .models import SyncedModel

Collections = Mapping[str, Collection]


def now_ms() -> int:
    return int(time.time() * 1000)


def lock_household(household_id: str) -> None:
    """
    Serialises writes per household until commit, so `seq` values become visible in order and a device
    that pulled up to N can never later miss a row with a smaller seq.
    """
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", [household_id])


def _next_seq() -> int:
    with connection.cursor() as cursor:
        cursor.execute("SELECT nextval('sync_seq')")
        return int(cursor.fetchone()[0])


def _merge(coll: Collection, actor: Actor | None, household_id: str, op: Op) -> int | None:
    """Applies the fields of `op` that are newer than what's stored. Returns the new seq, or None if nothing changed."""
    row = coll.model.objects.select_for_update().filter(household_id=household_id, record_id=op.id).first()
    stamps: dict[str, int] = dict(row.field_ts) if row else {}
    fresh = {k: v for k, v in coll.incoming(op.fields).items() if op.ts > stamps.get(k, -1)}
    if not fresh:
        return None
    if actor is not None and coll.authorize is not None:
        coll.authorize(actor, row, fresh)

    deletion_changed = "deleted" in fresh
    deleted = bool(fresh.pop("deleted")) if deletion_changed else bool(row and row.deleted)
    if deleted and (row is None or not deletion_changed):
        return None  # deleting something the server never had, or editing a deleted record
    if deletion_changed:
        stamps["deleted"] = op.ts
    is_new = row is None
    if row is None:
        row = coll.model(household_id=household_id, record_id=op.id)

    if not deleted:
        # Validate the whole record as it will be after the merge (cross-field rules included).
        merged = {**({} if is_new else coll.current(row)), **fresh}
        values = coll.schema.model_validate(merged).model_dump()
        # A new record takes every field (defaults included); an existing one only the newer fields.
        for name in values if is_new else fresh:
            setattr(row, name, values[name])
        for name in fresh:
            stamps[name] = op.ts
    # A tombstone ignores other fields: they keep their old stamps, so a later "undo" can restore them.
    row.deleted = deleted
    row.field_ts = stamps
    row.seq = _next_seq()
    row.save()
    return row.seq


def _record(coll: Collection, household_id: str, record_id: str) -> dict[str, Any] | None:
    row = coll.model.objects.filter(household_id=household_id, record_id=record_id).first()
    return coll.serialize(row) if row else None


def _validation_message(exc: ValidationError) -> str:
    return "; ".join(f"{'.'.join(map(str, e['loc'])) or 'record'}: {e['msg']}" for e in exc.errors())


def _apply_one(colls: Collections, actor: Actor | None, household_id: str, op: Op) -> tuple[OpResult, int | None]:
    coll = colls.get(op.collection)
    if coll is None:
        return OpResult(op_id=op.op_id, status="rejected", code="unknown_collection", message=op.collection), None
    try:
        with transaction.atomic():
            seq = _merge(coll, actor, household_id, op)
    except RejectedError as exc:
        code, message = exc.code, exc.message
    except ValidationError as exc:
        code, message = "invalid", _validation_message(exc)
    else:
        return OpResult(op_id=op.op_id, status="ok"), seq
    record = _record(coll, household_id, op.id)
    return OpResult(op_id=op.op_id, status="rejected", code=code, message=message, record=record), None


def _trim(colls: Collections, touched: set[str], household_id: str) -> None:
    for name in touched:
        coll = colls[name]
        if coll.retain is None:
            continue
        order, keep = coll.retain
        rows = coll.model.objects.filter(household_id=household_id)
        newest = list(rows.order_by(f"-{order}").values_list("pk", flat=True)[:keep])
        rows.exclude(pk__in=newest).delete()


def apply_ops(
    colls: Collections, actor: Actor | None, household_id: str, ops: Sequence[Op]
) -> tuple[PushOut, int | None]:
    """
    Applies a batch of ops; each one succeeds or is rejected on its own. `actor=None` is a trusted
    server-side write that skips the collections' authorizers. Returns the response and, if anything
    changed, the household's new cursor for the live-update notification.
    """
    results: list[OpResult] = []
    cursor: int | None = None
    touched: set[str] = set()
    with transaction.atomic():
        lock_household(household_id)
        for op in ops:
            result, seq = _apply_one(colls, actor, household_id, op)
            results.append(result)
            if seq is not None:
                cursor = seq
                touched.add(op.collection)
        _trim(colls, touched, household_id)
    return PushOut(results=results, server_time=now_ms()), cursor


def _max_seq() -> int:
    with connection.cursor() as cursor:
        cursor.execute("SELECT CASE WHEN is_called THEN last_value ELSE 0 END FROM sync_seq")
        return int(cursor.fetchone()[0])


def pull_changes(colls: Collections, household_id: str, since: int, limit: int) -> PullOut:
    """Everything in the household with seq > `since`, oldest first, across all of the service's collections."""
    outer = not connection.in_atomic_block
    with transaction.atomic():
        if outer:
            # One snapshot for all tables, so a write landing between two queries can't be skipped.
            with connection.cursor() as cur:
                cur.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
        if since > _max_seq():
            return PullOut(changes=[], cursor=0, more=True, reset=True, server_time=now_ms())
        rows: list[tuple[int, Collection, SyncedModel]] = []
        for coll in colls.values():
            found = coll.model.objects.filter(household_id=household_id, seq__gt=since).order_by("seq")[: limit + 1]
            rows.extend((row.seq, coll, row) for row in found)
    rows.sort(key=lambda r: r[0])
    page = rows[:limit]
    changes = [Change(collection=coll.name, seq=seq, record=coll.serialize(row)) for seq, coll, row in page]
    return PullOut(
        changes=changes,
        cursor=page[-1][0] if page else since,
        more=len(rows) > limit,
        server_time=now_ms(),
    )

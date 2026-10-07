from typing import Any

from common.auth import Actor
from common.sync import Collection, RejectedError

from .models import Expense, Settlement
from .schemas import ExpenseRecord, SettlementRecord


def authorize_expense(actor: Actor, row: Expense | None, fields: dict[str, Any]) -> None:
    """D5: only the person who added an expense can change or delete it."""
    owner = row.created_by if row is not None else fields.get("created_by")
    if owner != actor.member_id:
        msg = "Only the person who added this expense can change it."
        raise RejectedError(msg)
    if row is not None and "created_by" in fields and fields["created_by"] != row.created_by:
        msg = "An expense can't change hands."
        raise RejectedError(msg)


def authorize_settlement(actor: Actor, row: Settlement | None, fields: dict[str, Any]) -> None:
    """Only the two people in a settlement can undo it."""
    if row is not None and fields.get("deleted") and actor.member_id not in (row.from_member, row.to_member):
        msg = "Only the people in this settlement can remove it."
        raise RejectedError(msg)


COLLECTIONS = [
    Collection("expenses", Expense, ExpenseRecord, authorize=authorize_expense),
    Collection("settlements", Settlement, SettlementRecord, authorize=authorize_settlement),
]

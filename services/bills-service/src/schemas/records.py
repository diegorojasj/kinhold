from datetime import date
from typing import Annotated, Literal

from pydantic import Field

from common.sync import ClientId, IsoDateTime, RecordSchema, RRule

# Bills become expenses when paid, so they use the expense categories (frontend/src/stores/money.ts).
ExpenseCategory = Literal["groceries", "rent", "utilities", "dining", "transport", "home", "fun", "other"]
Cents = Annotated[int, Field(ge=0, le=10_000_000_000)]
Name = Annotated[str, Field(min_length=1, max_length=120)]
Emoji = Annotated[str, Field(max_length=16)]


class BillRecord(RecordSchema):
    name: Name
    emoji: Emoji = ""
    amount_cents: Cents
    rrule: RRule
    dtstart: date
    next_due: date
    remind_days_before: Annotated[int, Field(ge=0, le=60)] = 3
    category: ExpenseCategory = "other"
    last_paid_at: date | None = None
    created_at: IsoDateTime


class PaymentRecord(RecordSchema):
    bill_id: ClientId
    name: Name
    emoji: Emoji = ""
    amount_cents: Cents
    due_date: date
    paid_at: date
    paid_by: ClientId
    expense_id: ClientId | None = None

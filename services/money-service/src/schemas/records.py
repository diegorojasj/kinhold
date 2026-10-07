from datetime import date
from typing import Annotated, Literal, Self

from pydantic import Field, model_validator

from common.sync import ClientId, IsoDateTime, RecordSchema

# Same ids as EXPENSE_CATEGORIES in frontend/src/stores/money.ts.
ExpenseCategory = Literal["groceries", "rent", "utilities", "dining", "transport", "home", "fun", "other"]
# Up to 100 million in the household currency.
Cents = Annotated[int, Field(gt=0, le=10_000_000_000)]


class Split(RecordSchema):
    user_id: ClientId
    amount_cents: Annotated[int, Field(ge=0, le=10_000_000_000)]


class ExpenseRecord(RecordSchema):
    description: Annotated[str, Field(min_length=1, max_length=200)]
    amount_cents: Cents
    paid_by: ClientId
    date: date
    category: ExpenseCategory = "other"
    split_mode: Literal["equal", "percent", "exact"] = "equal"
    split_input: Annotated[dict[ClientId, float], Field(max_length=20, default_factory=dict)]
    splits: Annotated[list[Split], Field(min_length=1, max_length=20)]
    created_by: ClientId
    created_at: IsoDateTime
    updated_at: IsoDateTime

    @model_validator(mode="after")
    def splits_add_up(self) -> Self:
        """D2: the parts must add up to the total, whatever the split mode."""
        if sum(s.amount_cents for s in self.splits) != self.amount_cents:
            msg = "splits must add up to the total"
            raise ValueError(msg)
        return self


class SettlementRecord(RecordSchema):
    from_member: ClientId = Field(alias="from")
    to_member: ClientId = Field(alias="to")
    amount_cents: Cents
    date: date
    created_at: IsoDateTime

    @model_validator(mode="after")
    def between_two_people(self) -> Self:
        if self.from_member == self.to_member:
            msg = "a settlement needs two different people"
            raise ValueError(msg)
        return self

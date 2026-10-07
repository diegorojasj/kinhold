from django.db import models

from common.sync import SyncedModel


class Bill(SyncedModel):
    """A repeating bill or subscription (E1, E2). Amounts in integer cents (D-06)."""

    name = models.CharField(max_length=120, default="")
    emoji = models.CharField(max_length=16, default="")
    amount_cents = models.BigIntegerField(default=0)
    rrule = models.CharField(max_length=300, default="")
    dtstart = models.DateField(null=True)
    next_due = models.DateField(null=True)
    remind_days_before = models.PositiveSmallIntegerField(default=3)
    category = models.CharField(max_length=20, default="other")
    last_paid_at = models.DateField(null=True)
    created_at = models.DateTimeField(null=True)


class BillPayment(SyncedModel):
    """A bill marked paid (E3); `expense_id` points to the expense in money-service, if one was created."""

    bill_id = models.CharField(max_length=64, default="")
    name = models.CharField(max_length=120, default="")
    emoji = models.CharField(max_length=16, default="")
    amount_cents = models.BigIntegerField(default=0)
    due_date = models.DateField(null=True)
    paid_at = models.DateField(null=True)
    paid_by = models.CharField(max_length=64, default="")
    expense_id = models.CharField(max_length=64, null=True, default=None)

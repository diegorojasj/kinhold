from django.db import models

from common.sync import SyncedModel


class Expense(SyncedModel):
    """A shared expense (D1, D2). Money is integer cents in the household currency (D-06)."""

    description = models.CharField(max_length=200, default="")
    amount_cents = models.BigIntegerField(default=0)
    paid_by = models.CharField(max_length=64, default="")
    date = models.DateField(null=True)
    category = models.CharField(max_length=20, default="other")
    split_mode = models.CharField(max_length=10, default="equal")
    # What the user typed per person (percent or cents), so the editor can reopen with it.
    split_input = models.JSONField(default=dict)
    splits = models.JSONField(default=list)
    created_by = models.CharField(max_length=64, default="")
    created_at = models.DateTimeField(null=True)
    updated_at = models.DateTimeField(null=True)

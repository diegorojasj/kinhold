from django.db import models

from common.sync import SyncedModel


class Item(SyncedModel):
    """A line on the household's shopping list (B1, B2)."""

    name = models.CharField(max_length=120, default="")
    qty = models.CharField(max_length=40, default="")
    note = models.CharField(max_length=500, default="")
    category = models.CharField(max_length=20, default="other")
    checked = models.BooleanField(default=False)
    checked_by = models.CharField(max_length=64, null=True, default=None)
    added_by = models.CharField(max_length=64, default="")
    created_at = models.DateTimeField(null=True)
    updated_at = models.DateTimeField(null=True)

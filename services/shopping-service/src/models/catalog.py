from django.db import models

from common.sync import SyncedModel


class CatalogEntry(SyncedModel):
    """What the household has bought before: autocomplete ranking and remembered aisle per name (B3, B4)."""

    name = models.CharField(max_length=120, default="")
    category = models.CharField(max_length=20, default="other")
    times_added = models.PositiveIntegerField(default=0)
    last_added_at = models.DateTimeField(null=True)

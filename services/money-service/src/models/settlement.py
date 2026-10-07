from django.db import models

from common.sync import SyncedModel


class Settlement(SyncedModel):
    """A payment that settles a debt between two members (D4)."""

    from_member = models.CharField(max_length=64, default="")
    to_member = models.CharField(max_length=64, default="")
    amount_cents = models.BigIntegerField(default=0)
    date = models.DateField(null=True)
    created_at = models.DateTimeField(null=True)

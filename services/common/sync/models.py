from django.db import models


class SyncedModel(models.Model):
    """
    A record that devices create offline. `record_id` is the client's id (unique per household),
    `field_ts` the client timestamp (ms) of each field's current value, and `deleted` a tombstone,
    so devices that were offline still learn about deletions.
    """

    household_id = models.CharField(max_length=64)
    record_id = models.CharField(max_length=200)
    seq = models.BigIntegerField(default=0)
    field_ts = models.JSONField(default=dict)
    deleted = models.BooleanField(default=False)

    class Meta:
        abstract = True
        constraints = [
            models.UniqueConstraint(fields=["household_id", "record_id"], name="%(app_label)s_%(class)s_record"),
        ]
        indexes = [models.Index(fields=["household_id", "seq"], name="%(app_label)s_%(class)s_seq")]

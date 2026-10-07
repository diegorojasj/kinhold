from django.db import models

from common.sync import SyncedModel


class Household(SyncedModel):
    """A2: name, currency (D-06) and timezone (D-10). `household_id` and `record_id` are both its id."""

    name = models.CharField(max_length=80, default="")
    emoji = models.CharField(max_length=16, default="")
    currency = models.CharField(max_length=3, default="EUR")
    timezone = models.CharField(max_length=64, default="UTC")
    created_at = models.DateTimeField(null=True)


class Member(SyncedModel):
    """A person in the household. Members can be added by name only; devices link to them (Membership)."""

    name = models.CharField(max_length=60, default="")
    color = models.CharField(max_length=7, default="#7a6a58")
    role = models.CharField(max_length=10, default="member")
    joined_at = models.DateTimeField(null=True)


class Activity(SyncedModel):
    """Household activity feed (F3)."""

    actor = models.CharField(max_length=64, default="")
    type = models.CharField(max_length=40, default="")
    payload = models.JSONField(default=dict)
    at = models.DateTimeField(null=True)

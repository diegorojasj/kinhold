from django.db import models

from common.sync import SyncedModel


class Chore(SyncedModel):
    """A repeating chore (C1, C2). `next_due` and `rotation_index` advance when it's done or skipped."""

    title = models.CharField(max_length=120, default="")
    emoji = models.CharField(max_length=16, default="")
    rrule = models.CharField(max_length=300, default="")
    dtstart = models.DateField(null=True)
    assignee_mode = models.CharField(max_length=10, default="fixed")
    assignees = models.JSONField(default=list)
    rotation_index = models.PositiveIntegerField(default=0)
    next_due = models.DateField(null=True)
    created_at = models.DateTimeField(null=True)


class ChoreEvent(SyncedModel):
    """History of done / skipped chores (C3)."""

    chore_id = models.CharField(max_length=64, default="")
    user_id = models.CharField(max_length=64, default="")
    action = models.CharField(max_length=10, default="done")
    due_at = models.DateField(null=True)
    day = models.DateField(null=True)
    at = models.DateTimeField(null=True)

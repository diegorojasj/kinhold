from django.db import models


class Device(models.Model):
    """
    An installed copy of the app (phone, browser, PWA). It proves who it is with a bearer token that
    only the device knows; the server keeps its SHA-256.
    """

    id = models.CharField(primary_key=True, max_length=32)
    token_hash = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)


class Membership(models.Model):
    """Which households a device can see, and which member it acts as in each."""

    device = models.ForeignKey(Device, on_delete=models.CASCADE, related_name="memberships")
    household_id = models.CharField(max_length=64)
    member_id = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["device", "household_id"], name="membership_device_household")]


class Invite(models.Model):
    """A3: a single-use code that lets a new device join, valid for 7 days."""

    code = models.CharField(max_length=16, unique=True)
    household_id = models.CharField(max_length=64)
    created_by = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True)
    used_by = models.ForeignKey(Device, null=True, on_delete=models.SET_NULL, related_name="+")

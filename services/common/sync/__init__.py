"""
Offline-first sync shared by every service.

Devices own their data: they write locally, queue each change as an *op* and push the queue when they
are online. An op sets some fields of one record at a client timestamp; the server keeps, per field,
the newest value (last-write-wins per field, D-09). Ops carry absolute values and client-generated ids
(D-08), so retrying one is harmless. Every accepted write takes the next `seq`, which devices use as the
cursor for "give me everything that changed since N".
"""

from .collection import Collection, RejectedError
from .models import SyncedModel
from .router import sync_router
from .schemas import ClientId, IsoDateTime, RecordSchema, RRule

__all__ = [
    "ClientId",
    "Collection",
    "IsoDateTime",
    "RRule",
    "RecordSchema",
    "RejectedError",
    "SyncedModel",
    "sync_router",
]

from common.api import create_api
from common.sync import sync_router

from ..synced import COLLECTIONS
from . import access, events

api = create_api("household")
api.add_router("/", sync_router("household", COLLECTIONS))
api.add_router("/", access.router)
api.add_router("/", events.router)

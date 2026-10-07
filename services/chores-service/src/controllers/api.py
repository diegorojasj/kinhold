from common.api import create_api
from common.sync import sync_router

from ..synced import COLLECTIONS

api = create_api("chores")
api.add_router("/", sync_router("chores", COLLECTIONS))

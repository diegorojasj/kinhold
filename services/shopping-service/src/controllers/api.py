from common.api import create_api
from common.sync import sync_router

from ..synced import COLLECTIONS

api = create_api("shopping")
api.add_router("/", sync_router("shopping", COLLECTIONS))

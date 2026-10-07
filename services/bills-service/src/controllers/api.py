from common.api import create_api
from common.sync import sync_router

from ..synced import COLLECTIONS

api = create_api("bills")
api.add_router("/", sync_router("bills", COLLECTIONS))

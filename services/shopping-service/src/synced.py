from common.sync import Collection

from .models import CatalogEntry, Item
from .schemas import CatalogRecord, ItemRecord

COLLECTIONS = [
    Collection("items", Item, ItemRecord),
    Collection("catalog", CatalogEntry, CatalogRecord),
]

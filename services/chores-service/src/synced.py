from common.sync import Collection

from .models import Chore, ChoreEvent
from .schemas import ChoreEventRecord, ChoreRecord

COLLECTIONS = [
    Collection("chores", Chore, ChoreRecord),
    Collection("events", ChoreEvent, ChoreEventRecord),
]

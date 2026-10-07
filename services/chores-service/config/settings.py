from common.settings import *  # noqa: F403
from common.settings import INSTALLED_APPS, database

DB_SCHEMA = "chores"
DATABASES = database(DB_SCHEMA)
INSTALLED_APPS = [*INSTALLED_APPS, "src.apps.ChoresConfig"]

from typing import Any

from django.apps import AppConfig
from django.conf import settings
from django.db import IntegrityError
from django.db.backends.base.base import NO_DB_ALIAS, BaseDatabaseWrapper
from django.db.backends.signals import connection_created

# (alias, database name) pairs whose schema already exists, so each process checks only once.
_schemas_ready: set[tuple[str, str]] = set()


def ensure_schema(sender: Any, connection: BaseDatabaseWrapper, **kwargs: Any) -> None:  # noqa: ARG001
    """Each service keeps its tables in its own Postgres schema (search_path), created on first connect."""
    key = (connection.alias, connection.settings_dict["NAME"])
    if connection.alias == NO_DB_ALIAS or key in _schemas_ready:  # skip Django's maintenance connection
        return
    try:
        with connection.cursor() as cursor:
            cursor.execute(f"CREATE SCHEMA IF NOT EXISTS {connection.ops.quote_name(settings.DB_SCHEMA)}")
    except IntegrityError:
        pass  # another worker created it at the same moment
    _schemas_ready.add(key)


class CommonConfig(AppConfig):
    name = "common"
    label = "common"

    def ready(self) -> None:
        connection_created.connect(ensure_schema)

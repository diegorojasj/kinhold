from django.db import migrations


class Migration(migrations.Migration):
    """Cursor for incremental pulls: every synced write takes the next value (one sequence per service schema)."""

    initial = True
    dependencies: list[tuple[str, str]] = []

    operations = [
        migrations.RunSQL(
            "CREATE SEQUENCE IF NOT EXISTS sync_seq",
            reverse_sql="DROP SEQUENCE IF EXISTS sync_seq",
        ),
    ]

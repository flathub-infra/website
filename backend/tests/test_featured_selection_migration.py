import runpy
import sqlite3
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock


def test_featured_selection_migration_preserves_apps_and_grid_layouts():
    migration = runpy.run_path(
        str(
            Path(__file__).parents[1]
            / "alembic/versions/9e2f6c8a104b_replace_carousel_selection_layout.py"
        )
    )
    with sqlite3.connect(":memory:") as db:
        db.executescript("""
            CREATE TABLE scheduledselection (id INTEGER PRIMARY KEY, layout TEXT);
            CREATE TABLE scheduledselectionapp (scheduled_selection_id INTEGER);
            INSERT INTO scheduledselection VALUES
                (1, 'carousel'), (2, 'carousel'), (3, 'grid');
            INSERT INTO scheduledselectionapp VALUES
                (1), (1), (1), (2), (2), (2), (2), (3);
        """)
        operations = SimpleNamespace(
            execute=db.execute,
            drop_constraint=Mock(),
            create_check_constraint=Mock(),
        )
        migration["upgrade"].__globals__["op"] = operations
        migration["upgrade"]()

        assert db.execute(
            "SELECT id, layout FROM scheduledselection ORDER BY id"
        ).fetchall() == [(1, "featured"), (2, "grid"), (3, "grid")]
        assert db.execute("SELECT count(*) FROM scheduledselectionapp").fetchone() == (
            8,
        )
        operations.create_check_constraint.assert_called_once_with(
            "scheduledselection_layout",
            "scheduledselection",
            "layout IN ('grid', 'featured')",
        )

        migration["downgrade"]()
        assert db.execute(
            "SELECT id, layout FROM scheduledselection ORDER BY id"
        ).fetchall() == [(1, "carousel"), (2, "grid"), (3, "grid")]
        assert operations.create_check_constraint.call_args.args == (
            "scheduledselection_layout",
            "scheduledselection",
            "layout IN ('grid', 'carousel')",
        )

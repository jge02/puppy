from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "puppy.db"


LEGACY_USER_FK_TABLES: tuple[tuple[str, str, tuple[str, ...]], ...] = (
    (
        "relationships",
        """
        CREATE TABLE {table_name} (
            id TEXT PRIMARY KEY,
            owner_id TEXT NOT NULL,
            puppy_id TEXT NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'paused', 'ended')),
            intimacy_score INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            FOREIGN KEY (owner_id) REFERENCES users(id),
            FOREIGN KEY (puppy_id) REFERENCES users(id),
            CHECK (owner_id <> puppy_id)
        )
        """,
        ("id", "owner_id", "puppy_id", "status", "intimacy_score", "created_at"),
    ),
    (
        "tasks",
        """
        CREATE TABLE {table_name} (
            id TEXT PRIMARY KEY,
            relationship_id TEXT NOT NULL,
            created_by TEXT NOT NULL,
            assigned_to TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            reward_coins INTEGER NOT NULL CHECK (reward_coins >= 0),
            deadline TEXT NULL,
            expected_submission_type TEXT NOT NULL DEFAULT 'note'
                CHECK (expected_submission_type IN ('note', 'image', 'video')),
            status TEXT NOT NULL CHECK (status IN ('open', 'submitted', 'approved', 'rejected', 'expired')),
            created_at TEXT NOT NULL,
            FOREIGN KEY (relationship_id) REFERENCES relationships(id),
            FOREIGN KEY (created_by) REFERENCES users(id),
            FOREIGN KEY (assigned_to) REFERENCES users(id)
        )
        """,
        (
            "id",
            "relationship_id",
            "created_by",
            "assigned_to",
            "title",
            "description",
            "reward_coins",
            "deadline",
            "expected_submission_type",
            "status",
            "created_at",
        ),
    ),
    (
        "task_submissions",
        """
        CREATE TABLE {table_name} (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL UNIQUE,
            submitter_id TEXT NOT NULL,
            note TEXT NULL,
            media_type TEXT NULL CHECK (media_type IN ('image', 'video')),
            media_url TEXT NULL,
            submitted_at TEXT NOT NULL,
            FOREIGN KEY (task_id) REFERENCES tasks(id),
            FOREIGN KEY (submitter_id) REFERENCES users(id)
        )
        """,
        ("id", "task_id", "submitter_id", "note", "media_type", "media_url", "submitted_at"),
    ),
    (
        "wallets",
        """
        CREATE TABLE {table_name} (
            user_id TEXT PRIMARY KEY,
            balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
            updated_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
        """,
        ("user_id", "balance", "updated_at"),
    ),
)


def _users_table_allows_switch(connection: sqlite3.Connection) -> bool:
    row = connection.execute(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'"
    ).fetchone()
    sql = row[0] if row else ""
    return "'switch'" in sql


def _table_exists(connection: sqlite3.Connection, table_name: str) -> bool:
    row = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
        (table_name,),
    ).fetchone()
    return row is not None


def _table_sql_references(connection: sqlite3.Connection, table_name: str, referenced_table: str) -> bool:
    row = connection.execute(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
        (table_name,),
    ).fetchone()
    sql = row[0] if row else ""
    return referenced_table in sql


def _column_exists(connection: sqlite3.Connection, table_name: str, column_name: str) -> bool:
    columns = connection.execute(f"PRAGMA table_info({table_name})").fetchall()
    return any(column[1] == column_name for column in columns)


def _rebuild_table(
    connection: sqlite3.Connection,
    table_name: str,
    create_table_sql: str,
    columns: tuple[str, ...],
) -> None:
    if not _table_exists(connection, table_name):
        return

    temp_table_name = f"{table_name}__rebuilt"
    column_list = ", ".join(columns)
    connection.execute(f"DROP TABLE IF EXISTS {temp_table_name}")
    connection.execute(create_table_sql.format(table_name=temp_table_name))
    connection.execute(
        f"INSERT INTO {temp_table_name} ({column_list}) SELECT {column_list} FROM {table_name}"
    )
    connection.execute(f"DROP TABLE {table_name}")
    connection.execute(f"ALTER TABLE {temp_table_name} RENAME TO {table_name}")


def _repair_legacy_user_foreign_keys(connection: sqlite3.Connection) -> None:
    tables_to_rebuild = [
        table_name
        for table_name, _, _ in LEGACY_USER_FK_TABLES
        if _table_sql_references(connection, table_name, "users_old")
    ]
    if not tables_to_rebuild and not _table_exists(connection, "users_old"):
        return

    connection.execute("PRAGMA foreign_keys = OFF;")
    try:
        for table_name, create_table_sql, columns in LEGACY_USER_FK_TABLES:
            if table_name in tables_to_rebuild:
                _rebuild_table(connection, table_name, create_table_sql, columns)

        if _table_exists(connection, "users_old"):
            remaining_reference = connection.execute(
                """
                SELECT 1
                FROM sqlite_master
                WHERE type = 'table' AND sql LIKE '%users_old%'
                LIMIT 1
                """
            ).fetchone()
            if remaining_reference is None:
                connection.execute("DROP TABLE users_old")
    finally:
        connection.execute("PRAGMA foreign_keys = ON;")


def _migrate_users_role_preference(connection: sqlite3.Connection) -> None:
    if not _users_table_allows_switch(connection):
        return

    connection.execute("PRAGMA foreign_keys = OFF;")
    try:
        connection.executescript(
            """
            ALTER TABLE users RENAME TO users_old;

            CREATE TABLE users (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                display_name TEXT NOT NULL,
                role_preference TEXT NOT NULL CHECK (role_preference IN ('owner', 'puppy')),
                invite_code TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL
            );

            INSERT INTO users (id, email, password_hash, display_name, role_preference, invite_code, created_at)
            SELECT
                id,
                email,
                password_hash,
                display_name,
                CASE WHEN role_preference = 'switch' THEN 'puppy' ELSE role_preference END,
                invite_code,
                created_at
            FROM users_old;

            DROP TABLE users_old;
            """
        )
        _repair_legacy_user_foreign_keys(connection)
    finally:
        connection.execute("PRAGMA foreign_keys = ON;")


def get_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON;")
    return connection


@contextmanager
def transactional_connection() -> sqlite3.Connection:
    connection = get_connection()
    try:
        connection.execute("BEGIN IMMEDIATE;")
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def init_db() -> None:
    connection = get_connection()
    try:
        _migrate_users_role_preference(connection)
        _repair_legacy_user_foreign_keys(connection)
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                display_name TEXT NOT NULL,
                role_preference TEXT NOT NULL CHECK (role_preference IN ('owner', 'puppy')),
                invite_code TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS relationships (
                id TEXT PRIMARY KEY,
                owner_id TEXT NOT NULL,
                puppy_id TEXT NOT NULL,
                status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'paused', 'ended')),
                intimacy_score INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                FOREIGN KEY (owner_id) REFERENCES users(id),
                FOREIGN KEY (puppy_id) REFERENCES users(id),
                CHECK (owner_id <> puppy_id)
            );

            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                relationship_id TEXT NOT NULL,
                created_by TEXT NOT NULL,
                assigned_to TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                reward_coins INTEGER NOT NULL CHECK (reward_coins >= 0),
                deadline TEXT NULL,
                expected_submission_type TEXT NOT NULL DEFAULT 'note'
                    CHECK (expected_submission_type IN ('note', 'image', 'video')),
                status TEXT NOT NULL CHECK (status IN ('open', 'submitted', 'approved', 'rejected', 'expired')),
                approved_at TEXT NULL,
                reward_granted INTEGER NOT NULL DEFAULT 0 CHECK (reward_granted IN (0, 1)),
                created_at TEXT NOT NULL,
                FOREIGN KEY (relationship_id) REFERENCES relationships(id),
                FOREIGN KEY (created_by) REFERENCES users(id),
                FOREIGN KEY (assigned_to) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS task_submissions (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL UNIQUE,
                submitter_id TEXT NOT NULL,
                note TEXT NULL,
                media_type TEXT NULL CHECK (media_type IN ('image', 'video')),
                media_url TEXT NULL,
                submitted_at TEXT NOT NULL,
                FOREIGN KEY (task_id) REFERENCES tasks(id),
                FOREIGN KEY (submitter_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS wallets (
                user_id TEXT PRIMARY KEY,
                balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS task_requests (
                id TEXT PRIMARY KEY,
                relationship_id TEXT NOT NULL,
                requester_id TEXT NOT NULL,
                title TEXT NOT NULL,
                note TEXT NULL,
                status TEXT NOT NULL CHECK (status IN ('pending', 'fulfilled', 'rejected')),
                linked_task_id TEXT NULL,
                created_at TEXT NOT NULL,
                handled_at TEXT NULL,
                handled_by TEXT NULL,
                FOREIGN KEY (relationship_id) REFERENCES relationships(id),
                FOREIGN KEY (requester_id) REFERENCES users(id),
                FOREIGN KEY (linked_task_id) REFERENCES tasks(id),
                FOREIGN KEY (handled_by) REFERENCES users(id)
            );

            CREATE INDEX IF NOT EXISTS idx_relationships_owner_id ON relationships(owner_id);
            CREATE INDEX IF NOT EXISTS idx_relationships_puppy_id ON relationships(puppy_id);
            CREATE UNIQUE INDEX IF NOT EXISTS idx_relationships_active_owner
                ON relationships(owner_id)
                WHERE status IN ('pending', 'active');
            CREATE UNIQUE INDEX IF NOT EXISTS idx_relationships_active_puppy
                ON relationships(puppy_id)
                WHERE status IN ('pending', 'active');
            CREATE UNIQUE INDEX IF NOT EXISTS idx_relationships_pair_open
                ON relationships(owner_id, puppy_id)
                WHERE status IN ('pending', 'active', 'paused');

            CREATE INDEX IF NOT EXISTS idx_tasks_relationship_id ON tasks(relationship_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
            CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
            CREATE INDEX IF NOT EXISTS idx_tasks_relationship_status ON tasks(relationship_id, status);
            CREATE INDEX IF NOT EXISTS idx_task_submissions_submitter_id ON task_submissions(submitter_id);
            CREATE INDEX IF NOT EXISTS idx_task_requests_relationship_id ON task_requests(relationship_id);
            CREATE INDEX IF NOT EXISTS idx_task_requests_requester_id ON task_requests(requester_id);
            CREATE INDEX IF NOT EXISTS idx_task_requests_status ON task_requests(status);
            CREATE INDEX IF NOT EXISTS idx_task_requests_relationship_status
                ON task_requests(relationship_id, status);
            """
        )
        if not _column_exists(connection, "tasks", "expected_submission_type"):
            connection.execute(
                """
                ALTER TABLE tasks
                ADD COLUMN expected_submission_type TEXT NOT NULL DEFAULT 'note'
                    CHECK (expected_submission_type IN ('note', 'image', 'video'))
                """
            )
        if not _column_exists(connection, "tasks", "approved_at"):
            connection.execute("ALTER TABLE tasks ADD COLUMN approved_at TEXT NULL")
        if not _column_exists(connection, "tasks", "reward_granted"):
            connection.execute(
                """
                ALTER TABLE tasks
                ADD COLUMN reward_granted INTEGER NOT NULL DEFAULT 0
                    CHECK (reward_granted IN (0, 1))
                """
            )
        if not _column_exists(connection, "task_submissions", "media_type"):
            connection.execute(
                """
                ALTER TABLE task_submissions
                ADD COLUMN media_type TEXT NULL
                    CHECK (media_type IN ('image', 'video'))
                """
            )
        if not _column_exists(connection, "task_submissions", "media_url"):
            connection.execute("ALTER TABLE task_submissions ADD COLUMN media_url TEXT NULL")
        connection.commit()
    finally:
        connection.close()

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
                created_at TEXT NOT NULL,
                gender TEXT NOT NULL DEFAULT 'private'
                    CHECK (gender IN ('male', 'female', 'trans', 'non_binary', 'private')),
                seeking_gender TEXT NOT NULL DEFAULT 'any'
                    CHECK (seeking_gender IN ('male', 'female', 'trans', 'non_binary', 'any')),
                sexual_orientation TEXT NOT NULL DEFAULT 'unspecified'
                    CHECK (sexual_orientation IN ('hetero', 'homo', 'bi', 'pan', 'asexual', 'questioning', 'unspecified')),
                identity_labels_json TEXT NOT NULL DEFAULT '[]'
            );

            INSERT INTO users (
                id, email, password_hash, display_name, role_preference, invite_code, created_at,
                gender, seeking_gender, sexual_orientation, identity_labels_json
            )
            SELECT
                id,
                email,
                password_hash,
                display_name,
                CASE WHEN role_preference = 'switch' THEN 'puppy' ELSE role_preference END,
                invite_code,
                created_at,
                'private',
                'any',
                'unspecified',
                '[]'
            FROM users_old;

            DROP TABLE users_old;
            """
        )
        _repair_legacy_user_foreign_keys(connection)
    finally:
        connection.execute("PRAGMA foreign_keys = ON;")


_DEFAULT_SHOP_ITEMS = [
    ("bottle_glass", "bottle_theme", "玻璃瓶", "经典透明玻璃瓶，简洁优雅", 0, 0, 1),
    ("bottle_ocean", "bottle_theme", "海洋瓶", "深海蓝色调，海浪纹理", 30, 1, 0),
    ("bottle_candy", "bottle_theme", "糖果瓶", "粉彩糖果色，甜蜜可爱", 30, 2, 0),
    ("bottle_mecha", "bottle_theme", "机械瓶", "赛博朋克金属质感", 50, 3, 0),
    ("orb_bubble", "orb_skin", "泡泡球", "晶莹剔透的泡泡效果", 0, 0, 1),
    ("orb_star", "orb_skin", "星星球", "闪亮星形小球", 20, 1, 0),
    ("orb_neon", "orb_skin", "霓虹球", "发光霓虹色彩", 40, 2, 0),
    ("orb_jelly", "orb_skin", "果冻球", "软萌果冻质感", 20, 3, 0),
    ("bg_default", "dashboard_bg", "默认背景", "简洁深色背景", 0, 0, 1),
    ("bg_aurora", "dashboard_bg", "极光背景", "绚丽北极光渐变", 40, 1, 0),
    ("bg_sakura", "dashboard_bg", "樱花背景", "粉色樱花飘落", 40, 2, 0),
    ("anim_default", "entry_animation", "默认入瓶", "小球平滑落入", 0, 0, 1),
    ("anim_burst", "entry_animation", "爆炸入瓶", "烟花爆炸效果", 30, 1, 0),
    ("anim_spiral", "entry_animation", "螺旋入瓶", "螺旋旋转落入", 30, 2, 0),
    ("frame_basic", "avatar_frame", "基础边框", "简洁圆形边框", 0, 0, 0),
    ("frame_gold", "avatar_frame", "金色边框", "金色光芒边框", 60, 1, 0),
    ("badge_diligent", "badge", "勤勉徽章", "连续完成7天任务", 0, 0, 0),
    ("title_beginner", "title_item", "新手主人", "刚刚开始的旅程", 0, 0, 0),
    ("title_veteran", "title_item", "资深主人", "完成50个任务解锁", 80, 1, 0),
]


def _seed_shop_items(connection: sqlite3.Connection) -> None:
    for item_id, item_type, name, description, price_coins, sort_order, is_default in _DEFAULT_SHOP_ITEMS:
        connection.execute(
            """
            INSERT OR IGNORE INTO shop_items (
                id, item_type, name, description, price_coins, sort_order, is_active, is_default
            )
            VALUES (?, ?, ?, ?, ?, ?, 1, ?)
            """,
            (item_id, item_type, name, description, price_coins, sort_order, is_default),
        )
        connection.execute(
            """
            UPDATE shop_items
            SET is_default = ?
            WHERE id = ?
            """,
            (is_default, item_id),
        )


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
                created_at TEXT NOT NULL,
                gender TEXT NOT NULL DEFAULT 'private'
                    CHECK (gender IN ('male', 'female', 'trans', 'non_binary', 'private')),
                seeking_gender TEXT NOT NULL DEFAULT 'any'
                    CHECK (seeking_gender IN ('male', 'female', 'trans', 'non_binary', 'any')),
                sexual_orientation TEXT NOT NULL DEFAULT 'unspecified'
                    CHECK (sexual_orientation IN ('hetero', 'homo', 'bi', 'pan', 'asexual', 'questioning', 'unspecified')),
                identity_labels_json TEXT NOT NULL DEFAULT '[]'
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

            CREATE TABLE IF NOT EXISTS match_posts (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                role_preference TEXT NOT NULL CHECK (role_preference IN ('owner', 'puppy')),
                intro TEXT NOT NULL,
                image_url TEXT NULL,
                status TEXT NOT NULL CHECK (status IN ('active', 'closed', 'matched')),
                created_at TEXT NOT NULL,
                expires_at TEXT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS match_requests (
                id TEXT PRIMARY KEY,
                post_id TEXT NOT NULL,
                requester_id TEXT NOT NULL,
                status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
                message TEXT NULL,
                reject_reason_code TEXT NULL,
                created_at TEXT NOT NULL,
                handled_at TEXT NULL,
                FOREIGN KEY (post_id) REFERENCES match_posts(id),
                FOREIGN KEY (requester_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS match_blocks (
                id TEXT PRIMARY KEY,
                blocker_user_id TEXT NOT NULL,
                blocked_user_id TEXT NOT NULL,
                reason TEXT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (blocker_user_id) REFERENCES users(id),
                FOREIGN KEY (blocked_user_id) REFERENCES users(id),
                CHECK (blocker_user_id <> blocked_user_id)
            );

            CREATE TABLE IF NOT EXISTS match_reports (
                id TEXT PRIMARY KEY,
                reporter_user_id TEXT NOT NULL,
                target_user_id TEXT NOT NULL,
                request_id TEXT NULL,
                reason TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (reporter_user_id) REFERENCES users(id),
                FOREIGN KEY (target_user_id) REFERENCES users(id),
                FOREIGN KEY (request_id) REFERENCES match_requests(id),
                CHECK (reporter_user_id <> target_user_id)
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

            CREATE INDEX IF NOT EXISTS idx_match_posts_status_created
                ON match_posts(status, created_at);
            CREATE UNIQUE INDEX IF NOT EXISTS idx_match_posts_user_active
                ON match_posts(user_id)
                WHERE status = 'active';
            CREATE INDEX IF NOT EXISTS idx_match_requests_post_status
                ON match_requests(post_id, status);
            CREATE INDEX IF NOT EXISTS idx_match_requests_requester_created
                ON match_requests(requester_id, created_at);
            CREATE UNIQUE INDEX IF NOT EXISTS idx_match_requests_pending_pair
                ON match_requests(post_id, requester_id)
                WHERE status = 'pending';
            CREATE UNIQUE INDEX IF NOT EXISTS idx_match_blocks_pair
                ON match_blocks(blocker_user_id, blocked_user_id);
            CREATE INDEX IF NOT EXISTS idx_match_reports_target_created
                ON match_reports(target_user_id, created_at);

            CREATE TABLE IF NOT EXISTS chat_messages (
                id TEXT PRIMARY KEY,
                relationship_id TEXT NOT NULL,
                sender_id TEXT NULL,
                kind TEXT NOT NULL CHECK (kind IN ('text', 'system_task')),
                content_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                client_msg_id TEXT NULL,
                FOREIGN KEY (relationship_id) REFERENCES relationships(id),
                FOREIGN KEY (sender_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS chat_reads (
                relationship_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                last_read_message_id TEXT NULL,
                last_read_at TEXT NOT NULL,
                PRIMARY KEY (relationship_id, user_id),
                FOREIGN KEY (relationship_id) REFERENCES relationships(id),
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (last_read_message_id) REFERENCES chat_messages(id)
            );

            CREATE INDEX IF NOT EXISTS idx_chat_messages_relationship_id
                ON chat_messages(relationship_id);
            CREATE INDEX IF NOT EXISTS idx_chat_messages_relationship_created
                ON chat_messages(relationship_id, created_at);
            CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id
                ON chat_messages(sender_id);

            CREATE TABLE IF NOT EXISTS growth_orbs (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL UNIQUE,
                relationship_id TEXT NOT NULL,
                owner_id TEXT NOT NULL,
                puppy_id TEXT NOT NULL,
                orb_type TEXT NOT NULL CHECK (orb_type IN ('note', 'image', 'video')),
                is_rare INTEGER NOT NULL DEFAULT 0 CHECK (is_rare IN (0, 1)),
                task_title TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (task_id) REFERENCES tasks(id),
                FOREIGN KEY (relationship_id) REFERENCES relationships(id),
                FOREIGN KEY (owner_id) REFERENCES users(id),
                FOREIGN KEY (puppy_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS shop_items (
                id TEXT PRIMARY KEY,
                item_type TEXT NOT NULL CHECK (item_type IN ('bottle_theme', 'orb_skin', 'dashboard_bg', 'entry_animation', 'avatar_frame', 'badge', 'title_item')),
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                price_coins INTEGER NOT NULL CHECK (price_coins >= 0),
                preview_url TEXT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
                is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
            );

            CREATE TABLE IF NOT EXISTS user_inventory (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                item_id TEXT NOT NULL,
                purchased_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (item_id) REFERENCES shop_items(id),
                UNIQUE (user_id, item_id)
            );

            CREATE TABLE IF NOT EXISTS user_equipped_cosmetics (
                user_id TEXT PRIMARY KEY,
                bottle_theme_id TEXT NULL,
                orb_skin_id TEXT NULL,
                dashboard_bg_id TEXT NULL,
                entry_animation_id TEXT NULL,
                avatar_frame_id TEXT NULL,
                title_item_id TEXT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE INDEX IF NOT EXISTS idx_growth_orbs_relationship ON growth_orbs(relationship_id);
            CREATE INDEX IF NOT EXISTS idx_growth_orbs_owner ON growth_orbs(owner_id);
            CREATE INDEX IF NOT EXISTS idx_growth_orbs_puppy ON growth_orbs(puppy_id);
            CREATE INDEX IF NOT EXISTS idx_user_inventory_user ON user_inventory(user_id);
            CREATE INDEX IF NOT EXISTS idx_shop_items_type ON shop_items(item_type);
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
        if _table_exists(connection, "match_requests") and not _column_exists(connection, "match_requests", "reject_reason_code"):
            connection.execute("ALTER TABLE match_requests ADD COLUMN reject_reason_code TEXT NULL")
        if _table_exists(connection, "match_posts") and not _column_exists(connection, "match_posts", "image_url"):
            connection.execute("ALTER TABLE match_posts ADD COLUMN image_url TEXT NULL")
        if _table_exists(connection, "users") and not _column_exists(connection, "users", "gender"):
            connection.execute(
                """
                ALTER TABLE users
                ADD COLUMN gender TEXT NOT NULL DEFAULT 'private'
                    CHECK (gender IN ('male', 'female', 'trans', 'non_binary', 'private'))
                """
            )
        if _table_exists(connection, "users") and not _column_exists(connection, "users", "seeking_gender"):
            connection.execute(
                """
                ALTER TABLE users
                ADD COLUMN seeking_gender TEXT NOT NULL DEFAULT 'any'
                    CHECK (seeking_gender IN ('male', 'female', 'trans', 'non_binary', 'any'))
                """
            )
        if _table_exists(connection, "users") and not _column_exists(connection, "users", "sexual_orientation"):
            connection.execute(
                """
                ALTER TABLE users
                ADD COLUMN sexual_orientation TEXT NOT NULL DEFAULT 'unspecified'
                    CHECK (sexual_orientation IN ('hetero', 'homo', 'bi', 'pan', 'asexual', 'questioning', 'unspecified'))
                """
            )
        if _table_exists(connection, "users") and not _column_exists(connection, "users", "identity_labels_json"):
            connection.execute("ALTER TABLE users ADD COLUMN identity_labels_json TEXT NOT NULL DEFAULT '[]'")
        if _table_exists(connection, "shop_items") and not _column_exists(connection, "shop_items", "is_default"):
            connection.execute(
                """
                ALTER TABLE shop_items
                ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0
                    CHECK (is_default IN (0, 1))
                """
            )
        _seed_shop_items(connection)
        connection.commit()
    finally:
        connection.close()

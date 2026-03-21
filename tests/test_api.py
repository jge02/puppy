from __future__ import annotations

import importlib
from io import BytesIO
import os
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from time import sleep

from pydantic import ValidationError


class PuppyApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.temp_dir.name, "test.db")
        os.environ["PUPPY_SECRET_KEY"] = "test-secret"
        os.environ["PUPPY_ADMIN_TOKEN"] = "admin-secret"

        from app import database

        self.database = database
        database.DB_PATH = database.Path(self.db_path)
        database.init_db()

        from app.routes.admin import admin_stats
        from app.routes.auth import login, register, update_profile
        from app.routes.chat import get_chat_messages, get_chat_unread, mark_chat_read
        from app.routes.match import (
            accept_match_request,
            block_user,
            create_match_post,
            create_match_request,
            list_match_request_inbox,
            list_sent_match_requests,
        )
        from app.routes.relationships import bind_by_invite
        from app.routes.shop import EquipRequest, equip_item, list_shop_items
        from app.routes.task_requests import create_task_request, list_task_requests, reject_task_request
        from app.routes.tasks import approve_task, create_task, submit_task
        from app.schemas import (
            BlockUserRequest,
            ChatReadRequest,
            CreateTaskRequestRequest,
            BindByInviteRequest,
            CreateMatchPostRequest,
            CreateMatchRequestRequest,
            CreateTaskRequest,
            HandleMatchRequestRequest,
            LoginRequest,
            RejectTaskRequestRequest,
            RegisterRequest,
            SubmitTaskRequest,
            UpdateProfileRequest,
        )

        self.approve_task = approve_task
        self.bind_by_invite = bind_by_invite
        self.get_chat_messages = get_chat_messages
        self.get_chat_unread = get_chat_unread
        self.mark_chat_read = mark_chat_read
        self.create_task_request_endpoint = create_task_request
        self.create_task = create_task
        self.create_match_post = create_match_post
        self.create_match_request = create_match_request
        self.equip_item = equip_item
        self.list_shop_items = list_shop_items
        self.list_task_requests = list_task_requests
        self.list_match_request_inbox = list_match_request_inbox
        self.list_sent_match_requests = list_sent_match_requests
        self.login_endpoint = login
        self.update_profile_endpoint = update_profile
        self.accept_match_request = accept_match_request
        self.admin_stats = admin_stats
        self.block_user = block_user
        self.reject_task_request_endpoint = reject_task_request
        self.register_endpoint = register
        self.submit_task = submit_task
        self.BlockUserRequest = BlockUserRequest
        self.BindByInviteRequest = BindByInviteRequest
        self.ChatReadRequest = ChatReadRequest
        self.CreateMatchPostRequest = CreateMatchPostRequest
        self.CreateMatchRequestRequest = CreateMatchRequestRequest
        self.CreateTaskRequest = CreateTaskRequest
        self.CreateTaskRequestRequest = CreateTaskRequestRequest
        self.EquipRequest = EquipRequest
        self.HandleMatchRequestRequest = HandleMatchRequestRequest
        self.LoginRequest = LoginRequest
        self.RejectTaskRequestRequest = RejectTaskRequestRequest
        self.RegisterRequest = RegisterRequest
        self.SubmitTaskRequest = SubmitTaskRequest
        self.UpdateProfileRequest = UpdateProfileRequest

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def register(self, email: str, role: str) -> dict:
        return self.register_endpoint(
            self.RegisterRequest(
                email=email,
                password="password123",
                display_name=email.split("@")[0],
                role_preference=role,
            )
        )

    def bind_active_relationship(self, owner_role: str = "owner", puppy_role: str = "puppy") -> tuple[dict, dict, str]:
        owner = self.register("owner@example.com", owner_role)
        puppy = self.register("puppy@example.com", puppy_role)
        bind = self.bind_by_invite(
            self.BindByInviteRequest(invite_code=owner["user"]["invite_code"]),
            current_user=puppy["user"],
        )
        return owner, puppy, bind["relationship"]["id"]

    def test_register_login_and_wallet(self) -> None:
        registered = self.register("owner@example.com", "owner")
        self.assertEqual(registered["wallet"]["balance"], 0)
        self.assertEqual(registered["user"]["gender"], "private")
        self.assertEqual(registered["user"]["seeking_gender"], "any")
        self.assertEqual(registered["user"]["sexual_orientation"], "unspecified")
        self.assertEqual(registered["user"]["identity_labels"], [])

        login_result = self.login_endpoint(
            self.LoginRequest(email="OWNER@example.com", password="password123")
        )
        self.assertEqual(login_result["user"]["email"], "owner@example.com")
        self.assertEqual(login_result["user"]["identity_labels"], [])

    def test_register_and_patch_profile_fields(self) -> None:
        registered = self.register_endpoint(
            self.RegisterRequest(
                email="profile@example.com",
                password="password123",
                display_name="profile",
                role_preference="owner",
                gender="female",
                seeking_gender="any",
                sexual_orientation="pan",
                identity_labels=["4i", "ts", "4i"],
            )
        )
        self.assertEqual(registered["user"]["gender"], "female")
        self.assertEqual(registered["user"]["sexual_orientation"], "pan")
        self.assertEqual(registered["user"]["identity_labels"], ["4i", "ts"])

        patched = self.update_profile_endpoint(
            self.UpdateProfileRequest(
                display_name="profile-updated",
                identity_labels=["cd", "4i", "cd"],
            ),
            current_user=registered["user"],
        )
        self.assertEqual(patched["user"]["display_name"], "profile-updated")
        self.assertEqual(patched["user"]["identity_labels"], ["cd", "4i"])
        self.assertEqual(patched["user"]["gender"], "female")
        self.assertEqual(patched["user"]["sexual_orientation"], "pan")

        me = self.database.get_connection()
        try:
            row = me.execute(
                """
                SELECT display_name, gender, seeking_gender, sexual_orientation, identity_labels_json
                FROM users WHERE id = ?
                """,
                (registered["user"]["id"],),
            ).fetchone()
        finally:
            me.close()
        self.assertEqual(row["display_name"], "profile-updated")
        self.assertEqual(row["gender"], "female")
        self.assertEqual(row["seeking_gender"], "any")
        self.assertEqual(row["sexual_orientation"], "pan")
        self.assertEqual(row["identity_labels_json"], '["cd","4i"]')

    def test_invalid_identity_label_is_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            self.RegisterRequest(
                email="bad-label@example.com",
                password="password123",
                display_name="bad",
                role_preference="owner",
                identity_labels=["unknown"],  # type: ignore[list-item]
            )

    def test_owner_can_bind_using_puppy_invite_code(self) -> None:
        owner = self.register("owner-bind@example.com", "owner")
        puppy = self.register("puppy-bind@example.com", "puppy")

        bind = self.bind_by_invite(
            self.BindByInviteRequest(invite_code=puppy["user"]["invite_code"]),
            current_user=owner["user"],
        )

        self.assertEqual(bind["owner"]["id"], owner["user"]["id"])
        self.assertEqual(bind["puppy"]["id"], puppy["user"]["id"])
        self.assertEqual(bind["relationship"]["owner_id"], owner["user"]["id"])
        self.assertEqual(bind["relationship"]["puppy_id"], puppy["user"]["id"])

    def test_switch_role_is_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            self.RegisterRequest(
                email="switch@example.com",
                password="password123",
                display_name="switch",
                role_preference="switch",
            )

    def test_same_role_accounts_cannot_bind(self) -> None:
        owner_a = self.register("owner-a@example.com", "owner")
        owner_b = self.register("owner-b@example.com", "owner")

        with self.assertRaises(Exception) as context:
            self.bind_by_invite(
                self.BindByInviteRequest(invite_code=owner_b["user"]["invite_code"]),
                current_user=owner_a["user"],
            )

        self.assertEqual(getattr(context.exception, "detail", None), "Accounts with the same role cannot be matched.")

    def test_relationship_task_and_reward_flow(self) -> None:
        owner, puppy, relationship_id = self.bind_active_relationship()

        task = self.create_task(
            self.CreateTaskRequest(
                relationship_id=relationship_id,
                title="Walk",
                description="Walk 5 minutes",
                reward_coins=10,
                deadline=None,
            ),
            current_user=owner["user"],
        )
        task_id = task["task"]["id"]

        submitted = self.submit_task(
            task_id,
            note="Done",
            media_file=None,
            current_user=puppy["user"],
        )
        self.assertEqual(submitted["task"]["status"], "submitted")

        approved = self.approve_task(task_id, current_user=owner["user"])
        self.assertEqual(approved["task"]["status"], "approved")
        self.assertEqual(approved["wallet"]["balance"], 1)

    def test_task_rewards_are_capped_at_five_per_day(self) -> None:
        owner, puppy, relationship_id = self.bind_active_relationship()

        for index in range(6):
            created = self.create_task(
                self.CreateTaskRequest(
                    relationship_id=relationship_id,
                    title=f"Task {index + 1}",
                    description="Complete it",
                    deadline=None,
                ),
                current_user=owner["user"],
            )
            task_id = created["task"]["id"]
            self.submit_task(
                task_id,
                note="Done",
                media_file=None,
                current_user=puppy["user"],
            )
            approved = self.approve_task(task_id, current_user=owner["user"])

        self.assertEqual(approved["wallet"]["balance"], 5)

        connection = self.database.get_connection()
        try:
            puppy_wallet = connection.execute(
                "SELECT balance FROM wallets WHERE user_id = ?",
                (puppy["user"]["id"],),
            ).fetchone()
            rewarded_tasks = connection.execute(
                "SELECT COUNT(*) AS count FROM tasks WHERE reward_granted = 1",
            ).fetchone()
        finally:
            connection.close()

        self.assertEqual(puppy_wallet["balance"], 5)
        self.assertEqual(rewarded_tasks["count"], 5)

    def test_expired_task_cannot_be_submitted(self) -> None:
        owner = self.register("owner2@example.com", "owner")
        puppy = self.register("puppy2@example.com", "puppy")

        bind = self.bind_by_invite(
            self.BindByInviteRequest(invite_code=owner["user"]["invite_code"]),
            current_user=puppy["user"],
        )
        relationship_id = bind["relationship"]["id"]

        deadline = (datetime.now(timezone.utc) + timedelta(seconds=1)).isoformat()
        task = self.create_task(
            self.CreateTaskRequest(
                relationship_id=relationship_id,
                title="Feed",
                description="Feed now",
                reward_coins=1,
                deadline=deadline,
            ),
            current_user=owner["user"],
        )
        task_id = task["task"]["id"]

        sleep(1.2)
        with self.assertRaises(Exception) as context:
            self.submit_task(
                task_id,
                note="Too late",
                media_file=None,
                current_user=puppy["user"],
            )
        self.assertEqual(getattr(context.exception, "detail", None), "Task has expired.")

    def test_task_submission_rejects_files_larger_than_backend_limit(self) -> None:
        owner, puppy, relationship_id = self.bind_active_relationship()

        created = self.create_task(
            self.CreateTaskRequest(
                relationship_id=relationship_id,
                title="Upload proof",
                description="Attach an image",
                deadline=None,
                expected_submission_type="image",
            ),
            current_user=owner["user"],
        )
        task_id = created["task"]["id"]

        os.environ["PUPPY_TASK_SUBMISSION_MAX_FILE_SIZE_MB"] = "0.0001"
        from app.routes import tasks as tasks_module

        tasks_module = importlib.reload(tasks_module)
        oversized_file = tasks_module.UploadFile(
            file=BytesIO(b"a" * 1024),
            filename="proof.jpg",
            headers={"content-type": "image/jpeg"},
        )

        try:
            with self.assertRaises(Exception) as context:
                tasks_module.submit_task(
                    task_id,
                    note="Proof attached",
                    media_file=oversized_file,
                    current_user=puppy["user"],
                )
            self.assertEqual(getattr(context.exception, "status_code", None), 413)
            self.assertEqual(
                getattr(context.exception, "detail", None),
                "Uploaded file exceeds the allowed size limit.",
            )
        finally:
            os.environ.pop("PUPPY_TASK_SUBMISSION_MAX_FILE_SIZE_MB", None)
            importlib.reload(tasks_module)

        connection = self.database.get_connection()
        try:
            submission_count = connection.execute(
                "SELECT COUNT(*) AS count FROM task_submissions WHERE task_id = ?",
                (task_id,),
            ).fetchone()
        finally:
            connection.close()
        self.assertEqual(submission_count["count"], 0)

    def test_task_request_flow(self) -> None:
        owner, puppy, relationship_id = self.bind_active_relationship()

        created = self.create_task_request_endpoint(
            self.CreateTaskRequestRequest(
                relationship_id=relationship_id,
                title="Want a training task",
                note="Please assign something structured.",
            ),
            current_user=puppy["user"],
        )
        task_request = created["task_request"]
        self.assertEqual(task_request["status"], "pending")

        owner_list = self.list_task_requests(relationship_id=relationship_id, current_user=owner["user"])
        self.assertEqual(len(owner_list["task_requests"]), 1)

        puppy_list = self.list_task_requests(relationship_id=relationship_id, current_user=puppy["user"])
        self.assertEqual(len(puppy_list["task_requests"]), 1)

        created_task = self.create_task(
            self.CreateTaskRequest(
                relationship_id=relationship_id,
                task_request_id=task_request["id"],
                title="Training",
                description="Practice for 10 minutes",
                reward_coins=3,
                deadline=None,
            ),
            current_user=owner["user"],
        )

        refreshed = self.list_task_requests(relationship_id=relationship_id, current_user=owner["user"])
        self.assertEqual(refreshed["task_requests"][0]["status"], "fulfilled")
        self.assertEqual(refreshed["task_requests"][0]["linked_task_id"], created_task["task"]["id"])

    def test_task_request_permissions_and_rejection(self) -> None:
        owner, puppy, relationship_id = self.bind_active_relationship()

        created = self.create_task_request_endpoint(
            self.CreateTaskRequestRequest(
                relationship_id=relationship_id,
                title="Need something to do",
                note=None,
            ),
            current_user=puppy["user"],
        )
        task_request_id = created["task_request"]["id"]

        with self.assertRaises(Exception) as owner_create_error:
            self.create_task_request_endpoint(
                self.CreateTaskRequestRequest(
                    relationship_id=relationship_id,
                    title="Nope",
                    note=None,
                ),
                current_user=owner["user"],
            )
        self.assertEqual(getattr(owner_create_error.exception, "detail", None), "Only puppy can request tasks.")

        rejected = self.reject_task_request_endpoint(
            task_request_id,
            self.RejectTaskRequestRequest(reason="Not now"),
            current_user=owner["user"],
        )
        self.assertEqual(rejected["task_request"]["status"], "rejected")

        with self.assertRaises(Exception) as second_reject_error:
            self.reject_task_request_endpoint(
                task_request_id,
                self.RejectTaskRequestRequest(reason="Still no"),
                current_user=owner["user"],
            )
        self.assertEqual(getattr(second_reject_error.exception, "detail", None), "Task request is not pending.")

        with self.assertRaises(Exception) as puppy_reject_error:
            self.reject_task_request_endpoint(
                task_request_id,
                self.RejectTaskRequestRequest(reason="self reject"),
                current_user=puppy["user"],
            )
        self.assertEqual(getattr(puppy_reject_error.exception, "detail", None), "Only owner can reject task requests.")

    def test_task_requests_require_active_relationship(self) -> None:
        owner, puppy, relationship_id = self.bind_active_relationship()
        connection = self.database.get_connection()
        try:
            connection.execute("UPDATE relationships SET status = 'paused' WHERE id = ?", (relationship_id,))
            connection.commit()
        finally:
            connection.close()

        with self.assertRaises(Exception) as context:
            self.create_task_request_endpoint(
                self.CreateTaskRequestRequest(
                    relationship_id=relationship_id,
                    title="Need something",
                    note=None,
                ),
                current_user=puppy["user"],
            )
        self.assertEqual(getattr(context.exception, "detail", None), "Task requests require an active relationship.")

    def test_user_role_migration_maps_switch_to_puppy(self) -> None:
        legacy_path = os.path.join(self.temp_dir.name, "legacy.db")
        self.database.DB_PATH = self.database.Path(legacy_path)

        connection = self.database.get_connection()
        try:
            connection.executescript(
                """
                CREATE TABLE users (
                    id TEXT PRIMARY KEY,
                    email TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    display_name TEXT NOT NULL,
                    role_preference TEXT NOT NULL CHECK (role_preference IN ('owner', 'puppy', 'switch')),
                    invite_code TEXT NOT NULL UNIQUE,
                    created_at TEXT NOT NULL
                );
                """
            )
            connection.execute(
                """
                INSERT INTO users (id, email, password_hash, display_name, role_preference, invite_code, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    "legacy-user",
                    "legacy@example.com",
                    "hash",
                    "legacy",
                    "switch",
                    "CODE1234",
                    datetime.now(timezone.utc).isoformat(),
                ),
            )
            connection.commit()
        finally:
            connection.close()

        self.database.init_db()

        migrated = self.database.get_connection()
        try:
            row = migrated.execute(
                "SELECT role_preference FROM users WHERE id = ?",
                ("legacy-user",),
            ).fetchone()
            self.assertEqual(row["role_preference"], "puppy")
        finally:
            migrated.close()

    def test_chat_message_history_and_unread_flow(self) -> None:
        owner, puppy, relationship_id = self.bind_active_relationship()
        self.create_task(
            self.CreateTaskRequest(
                relationship_id=relationship_id,
                title="System message task",
                description="Generate system task message",
                deadline=None,
            ),
            current_user=owner["user"],
        )

        messages_result = self.get_chat_messages(relationship_id=relationship_id, current_user=owner["user"])
        self.assertGreaterEqual(len(messages_result["messages"]), 1)
        latest = messages_result["messages"][-1]
        self.assertEqual(latest["kind"], "system_task")
        self.assertEqual(latest["content"]["action"], "task_created")

        unread_before = self.get_chat_unread(relationship_id=relationship_id, current_user=puppy["user"])
        self.assertGreaterEqual(unread_before["unread_count"], 1)

        self.mark_chat_read(
            self.ChatReadRequest(relationship_id=relationship_id, message_id=latest["id"]),
            current_user=puppy["user"],
        )
        unread_after = self.get_chat_unread(relationship_id=relationship_id, current_user=puppy["user"])
        self.assertEqual(unread_after["unread_count"], 0)

    def test_chat_requires_relationship_membership(self) -> None:
        owner, _, relationship_id = self.bind_active_relationship()
        outsider = self.register("outsider@example.com", "owner")
        with self.assertRaises(Exception) as context:
            self.get_chat_messages(relationship_id=relationship_id, current_user=outsider["user"])
        self.assertEqual(getattr(context.exception, "detail", None), "User is not part of this relationship.")

    def test_match_same_role_is_forbidden(self) -> None:
        owner_a = self.register("match-owner-a@example.com", "owner")
        owner_b = self.register("match-owner-b@example.com", "owner")
        post = self.create_match_post(
            self.CreateMatchPostRequest(intro="Need a partner"),
            current_user=owner_b["user"],
        )

        with self.assertRaises(Exception) as context:
            self.create_match_request(
                post["post"]["id"],
                self.CreateMatchRequestRequest(message="hello"),
                current_user=owner_a["user"],
                user_timezone="America/Vancouver",
            )
        detail = getattr(context.exception, "detail", None)
        self.assertIsInstance(detail, dict)
        self.assertEqual(detail.get("code"), "MATCH_SAME_ROLE_FORBIDDEN")

    def test_match_posts_include_profile_fields(self) -> None:
        owner = self.register_endpoint(
            self.RegisterRequest(
                email="profile-owner@example.com",
                password="password123",
                display_name="owner-profile",
                role_preference="owner",
                gender="male",
                seeking_gender="female",
                sexual_orientation="hetero",
                identity_labels=["4i"],
            )
        )
        puppy = self.register("profile-puppy@example.com", "puppy")
        self.create_match_post(
            self.CreateMatchPostRequest(intro="owner post"),
            current_user=owner["user"],
        )

        from app.routes.match import list_match_posts

        listing = list_match_posts(limit=20, include_mine=False, current_user=puppy["user"])
        self.assertEqual(len(listing["posts"]), 1)
        post = listing["posts"][0]
        self.assertEqual(post["gender"], "male")
        self.assertEqual(post["seeking_gender"], "female")
        self.assertEqual(post["sexual_orientation"], "hetero")
        self.assertEqual(post["identity_labels"], ["4i"])

    def test_match_daily_limit_is_five(self) -> None:
        requester = self.register("match-limit-puppy@example.com", "puppy")
        owners = [self.register(f"match-owner-{index}@example.com", "owner") for index in range(6)]
        posts = [
            self.create_match_post(self.CreateMatchPostRequest(intro=f"post {index}"), current_user=owner["user"])
            for index, owner in enumerate(owners)
        ]

        for index in range(5):
            self.create_match_request(
                posts[index]["post"]["id"],
                self.CreateMatchRequestRequest(message="hello"),
                current_user=requester["user"],
                user_timezone="America/Vancouver",
            )

        with self.assertRaises(Exception) as context:
            self.create_match_request(
                posts[5]["post"]["id"],
                self.CreateMatchRequestRequest(message="6th"),
                current_user=requester["user"],
                user_timezone="America/Vancouver",
            )
        detail = getattr(context.exception, "detail", None)
        self.assertIsInstance(detail, dict)
        self.assertEqual(detail.get("code"), "MATCH_DAILY_LIMIT_REACHED")

    def test_match_block_returns_explicit_error(self) -> None:
        owner = self.register("match-block-owner@example.com", "owner")
        puppy = self.register("match-block-puppy@example.com", "puppy")
        post = self.create_match_post(
            self.CreateMatchPostRequest(intro="owner post"),
            current_user=owner["user"],
        )
        self.block_user(
            self.BlockUserRequest(target_user_id=puppy["user"]["id"], reason="no"),
            current_user=owner["user"],
        )

        with self.assertRaises(Exception) as context:
            self.create_match_request(
                post["post"]["id"],
                self.CreateMatchRequestRequest(message="please"),
                current_user=puppy["user"],
                user_timezone="America/Vancouver",
            )
        detail = getattr(context.exception, "detail", None)
        self.assertIsInstance(detail, dict)
        self.assertEqual(detail.get("code"), "MATCH_BLOCKED_BY_TARGET")

    def test_first_accept_wins_and_rejects_others(self) -> None:
        owner = self.register("match-accept-owner@example.com", "owner")
        puppy_a = self.register("match-accept-puppy-a@example.com", "puppy")
        puppy_b = self.register("match-accept-puppy-b@example.com", "puppy")
        post = self.create_match_post(
            self.CreateMatchPostRequest(intro="owner post"),
            current_user=owner["user"],
        )
        req_a = self.create_match_request(
            post["post"]["id"],
            self.CreateMatchRequestRequest(message="a"),
            current_user=puppy_a["user"],
            user_timezone="America/Vancouver",
        )
        req_b = self.create_match_request(
            post["post"]["id"],
            self.CreateMatchRequestRequest(message="b"),
            current_user=puppy_b["user"],
            user_timezone="America/Vancouver",
        )

        self.accept_match_request(
            req_a["request"]["id"],
            self.HandleMatchRequestRequest(reason=None),
            current_user=owner["user"],
        )

        inbox = self.list_match_request_inbox(current_user=owner["user"])
        statuses = {item["id"]: item for item in inbox["requests"]}
        self.assertEqual(statuses[req_a["request"]["id"]]["status"], "accepted")
        self.assertEqual(statuses[req_b["request"]["id"]]["status"], "rejected")
        self.assertEqual(statuses[req_b["request"]["id"]]["reject_reason_code"], "MATCH_ALREADY_PAIRED")

    def test_admin_stats_counts_registered_and_bound_users(self) -> None:
        self.register("admin-owner@example.com", "owner")
        puppy = self.register("admin-puppy@example.com", "puppy")
        extra = self.register("admin-extra@example.com", "owner")

        self.bind_by_invite(
            self.BindByInviteRequest(invite_code=extra["user"]["invite_code"]),
            current_user=puppy["user"],
        )

        stats = self.admin_stats("admin-secret")
        self.assertEqual(stats["users"]["total_registered"], 3)
        self.assertEqual(stats["users"]["bound"], 2)
        self.assertEqual(stats["users"]["unbound"], 1)
        self.assertEqual(stats["relationships"]["by_status"]["active"], 1)

    def test_admin_stats_rejects_invalid_token(self) -> None:
        with self.assertRaises(Exception) as context:
            self.admin_stats("wrong-token")
        self.assertEqual(getattr(context.exception, "detail", None), "Invalid admin token.")

    def test_shop_cannot_equip_inactive_free_item(self) -> None:
        owner = self.register("shop-owner@example.com", "owner")
        connection = self.database.get_connection()
        try:
            connection.execute("UPDATE shop_items SET is_active = 0 WHERE id = 'title_beginner'")
            connection.commit()
        finally:
            connection.close()

        visible_items = self.list_shop_items(current_user=owner["user"])
        visible_ids = {item["id"] for item in visible_items["items"]}
        self.assertNotIn("title_beginner", visible_ids)

        with self.assertRaises(Exception) as context:
            self.equip_item(self.EquipRequest(item_id="title_beginner"), current_user=owner["user"])
        self.assertEqual(getattr(context.exception, "detail", None), "Item not found.")

    def test_shop_default_items_are_owned_without_inventory(self) -> None:
        owner = self.register("shop-default-owner@example.com", "owner")

        visible_items = self.list_shop_items(current_user=owner["user"])
        items_by_id = {item["id"]: item for item in visible_items["items"]}

        self.assertTrue(items_by_id["bottle_glass"]["owned"])
        self.assertTrue(items_by_id["orb_bubble"]["owned"])
        self.assertFalse(items_by_id["title_beginner"]["owned"])

    def test_shop_can_equip_default_item_without_inventory_record(self) -> None:
        owner = self.register("shop-equip-owner@example.com", "owner")

        equipped = self.equip_item(self.EquipRequest(item_id="bottle_glass"), current_user=owner["user"])
        self.assertEqual(equipped["equipped"]["bottle_theme_id"], "bottle_glass")


if __name__ == "__main__":
    unittest.main()

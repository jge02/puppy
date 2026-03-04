from __future__ import annotations

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

        from app import database

        self.database = database
        database.DB_PATH = database.Path(self.db_path)
        database.init_db()

        from app.routes.auth import login, register
        from app.routes.relationships import bind_by_invite
        from app.routes.task_requests import create_task_request, list_task_requests, reject_task_request
        from app.routes.tasks import approve_task, create_task, submit_task
        from app.schemas import (
            CreateTaskRequestRequest,
            BindByInviteRequest,
            CreateTaskRequest,
            LoginRequest,
            RejectTaskRequestRequest,
            RegisterRequest,
            SubmitTaskRequest,
        )

        self.approve_task = approve_task
        self.bind_by_invite = bind_by_invite
        self.create_task_request_endpoint = create_task_request
        self.create_task = create_task
        self.list_task_requests = list_task_requests
        self.login_endpoint = login
        self.reject_task_request_endpoint = reject_task_request
        self.register_endpoint = register
        self.submit_task = submit_task
        self.BindByInviteRequest = BindByInviteRequest
        self.CreateTaskRequest = CreateTaskRequest
        self.CreateTaskRequestRequest = CreateTaskRequestRequest
        self.LoginRequest = LoginRequest
        self.RejectTaskRequestRequest = RejectTaskRequestRequest
        self.RegisterRequest = RegisterRequest
        self.SubmitTaskRequest = SubmitTaskRequest

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

        login_result = self.login_endpoint(
            self.LoginRequest(email="OWNER@example.com", password="password123")
        )
        self.assertEqual(login_result["user"]["email"], "owner@example.com")

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


if __name__ == "__main__":
    unittest.main()

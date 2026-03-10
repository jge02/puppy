from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException

from app.security import generate_invite_code


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def row_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    return dict(row) if row is not None else None


def decode_identity_labels(raw_value: Any) -> list[str]:
    if isinstance(raw_value, list):
        return [str(item) for item in raw_value]
    if not isinstance(raw_value, str) or not raw_value:
        return []
    try:
        parsed = json.loads(raw_value)
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    return [str(item) for item in parsed]


def encode_identity_labels(labels: list[str]) -> str:
    return json.dumps(labels, ensure_ascii=True, separators=(",", ":"))


def normalize_user_profile(user: dict[str, Any] | None) -> dict[str, Any] | None:
    if user is None:
        return None
    user["gender"] = user.get("gender") or "private"
    user["seeking_gender"] = user.get("seeking_gender") or "any"
    user["sexual_orientation"] = user.get("sexual_orientation") or "unspecified"
    labels = decode_identity_labels(user.get("identity_labels_json"))
    user["identity_labels"] = labels
    user.pop("identity_labels_json", None)
    return user


def generate_unique_invite_code(connection: sqlite3.Connection) -> str:
    for _ in range(10):
        invite_code = generate_invite_code()
        exists = connection.execute("SELECT 1 FROM users WHERE invite_code = ?", (invite_code,)).fetchone()
        if not exists:
            return invite_code
    raise HTTPException(status_code=500, detail="Unable to generate invite code.")


def get_current_relationship_for_user(connection: sqlite3.Connection, user_id: str) -> dict[str, Any] | None:
    row = connection.execute(
        """
        SELECT r.*,
               owner.display_name AS owner_display_name,
               puppy.display_name AS puppy_display_name,
               owner.email AS owner_email,
               puppy.email AS puppy_email
        FROM relationships r
        JOIN users owner ON owner.id = r.owner_id
        JOIN users puppy ON puppy.id = r.puppy_id
        WHERE (r.owner_id = ? OR r.puppy_id = ?)
          AND r.status IN ('pending', 'active')
        ORDER BY CASE r.status WHEN 'active' THEN 0 ELSE 1 END, r.created_at DESC
        LIMIT 1
        """,
        (user_id, user_id),
    ).fetchone()
    return row_to_dict(row)


def ensure_relationship_member(relationship: dict[str, Any], user_id: str) -> str:
    if relationship["owner_id"] == user_id:
        return "owner"
    if relationship["puppy_id"] == user_id:
        return "puppy"
    raise HTTPException(status_code=403, detail="User is not part of this relationship.")


def expire_task_if_needed(connection: sqlite3.Connection, task: dict[str, Any]) -> dict[str, Any]:
    if task["status"] != "open" or not task["deadline"]:
        return task
    deadline = datetime.fromisoformat(task["deadline"])
    if deadline >= datetime.now(timezone.utc):
        return task
    connection.execute("UPDATE tasks SET status = 'expired' WHERE id = ? AND status = 'open'", (task["id"],))
    task["status"] = "expired"
    return task


def load_task_with_relationship(connection: sqlite3.Connection, task_id: str) -> dict[str, Any]:
    row = connection.execute(
        """
        SELECT t.*,
               r.owner_id,
               r.puppy_id,
               r.status AS relationship_status
        FROM tasks t
        JOIN relationships r ON r.id = t.relationship_id
        WHERE t.id = ?
        """,
        (task_id,),
    ).fetchone()
    task = row_to_dict(row)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
    return expire_task_if_needed(connection, task)


def load_task_request_with_relationship(connection: sqlite3.Connection, request_id: str) -> dict[str, Any]:
    row = connection.execute(
        """
        SELECT tr.*,
               r.owner_id,
               r.puppy_id,
               r.status AS relationship_status
        FROM task_requests tr
        JOIN relationships r ON r.id = tr.relationship_id
        WHERE tr.id = ?
        """,
        (request_id,),
    ).fetchone()
    task_request = row_to_dict(row)
    if not task_request:
        raise HTTPException(status_code=404, detail="Task request not found.")
    return task_request


def get_wallet(connection: sqlite3.Connection, user_id: str) -> dict[str, Any]:
    row = connection.execute("SELECT user_id, balance, updated_at FROM wallets WHERE user_id = ?", (user_id,)).fetchone()
    wallet = row_to_dict(row)
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found.")
    return wallet

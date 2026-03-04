from __future__ import annotations

from pathlib import Path
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status

from app.database import BASE_DIR, get_connection, transactional_connection
from app.dependencies import get_current_user
from app.schemas import CreateTaskRequest, RejectTaskRequest
from app.services import (
    ensure_relationship_member,
    expire_task_if_needed,
    get_wallet,
    load_task_request_with_relationship,
    load_task_with_relationship,
    row_to_dict,
    utc_now,
)


router = APIRouter()
TASK_SUBMISSION_UPLOADS_DIR = BASE_DIR / "uploads" / "task-submissions"
TASK_REWARD_COINS = 1
DAILY_TASK_REWARD_LIMIT = 5


def _get_reward_window_bounds(now_iso: str) -> tuple[str, str]:
    now = datetime.fromisoformat(now_iso)
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    next_day_start = day_start + timedelta(days=1)
    return day_start.isoformat(), next_day_start.isoformat()


def _has_daily_reward_capacity(connection: Any, owner_id: str, puppy_id: str, now_iso: str) -> bool:
    window_start, window_end = _get_reward_window_bounds(now_iso)
    rewarded_count = connection.execute(
        """
        SELECT COUNT(*)
        FROM tasks t
        JOIN relationships r ON r.id = t.relationship_id
        WHERE r.owner_id = ?
          AND r.puppy_id = ?
          AND t.reward_granted = 1
          AND t.approved_at IS NOT NULL
          AND t.approved_at >= ?
          AND t.approved_at < ?
        """,
        (owner_id, puppy_id, window_start, window_end),
    ).fetchone()[0]
    return rewarded_count < DAILY_TASK_REWARD_LIMIT


def _store_submission_file(task_id: str, media_file: UploadFile, expected_type: str) -> str:
    if expected_type == "image":
        if not media_file.content_type or not media_file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="Task requires an image file.")
    elif expected_type == "video":
        if not media_file.content_type or not media_file.content_type.startswith("video/"):
            raise HTTPException(status_code=400, detail="Task requires a video file.")
    else:
        raise HTTPException(status_code=400, detail="This task does not accept file uploads.")

    suffix = Path(media_file.filename or "").suffix.lower()
    if not suffix:
        suffix = ".bin"

    TASK_SUBMISSION_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    stored_name = f"{task_id}_{uuid.uuid4().hex}{suffix}"
    stored_path = TASK_SUBMISSION_UPLOADS_DIR / stored_name

    with stored_path.open("wb") as output_file:
        while True:
            chunk = media_file.file.read(1024 * 1024)
            if not chunk:
                break
            output_file.write(chunk)

    return f"/uploads/task-submissions/{stored_name}"


@router.post("/tasks", status_code=status.HTTP_201_CREATED)
def create_task(payload: CreateTaskRequest, current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    with transactional_connection() as connection:
        relationship_row = connection.execute("SELECT * FROM relationships WHERE id = ?", (payload.relationship_id,)).fetchone()
        relationship = row_to_dict(relationship_row)
        if not relationship:
            raise HTTPException(status_code=404, detail="Relationship not found.")
        my_role = ensure_relationship_member(relationship, current_user["id"])
        if my_role != "owner":
            raise HTTPException(status_code=403, detail="Only owner can create tasks.")
        if relationship["status"] != "active":
            raise HTTPException(status_code=400, detail="Tasks can only be created in active relationships.")
        if payload.deadline and payload.deadline <= datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Deadline must be in the future.")
        task_request = None
        if payload.task_request_id:
            task_request = load_task_request_with_relationship(connection, payload.task_request_id)
            ensure_relationship_member(task_request, current_user["id"])
            if task_request["relationship_id"] != relationship["id"]:
                raise HTTPException(status_code=400, detail="Task request belongs to another relationship.")
            if task_request["relationship_status"] != "active":
                raise HTTPException(status_code=400, detail="Task request relationship is not active.")
            if task_request["status"] != "pending":
                raise HTTPException(status_code=400, detail="Task request is not pending.")

        task_id = str(uuid.uuid4())
        created_at = utc_now()
        connection.execute(
            """
            INSERT INTO tasks (
                id, relationship_id, created_by, assigned_to, title, description, reward_coins, deadline,
                expected_submission_type, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)
            """,
            (
                task_id,
                relationship["id"],
                relationship["owner_id"],
                relationship["puppy_id"],
                payload.title,
                payload.description,
                TASK_REWARD_COINS,
                payload.deadline.isoformat() if payload.deadline else None,
                payload.expected_submission_type,
                created_at,
            ),
        )
        if task_request:
            updated_request = connection.execute(
                """
                UPDATE task_requests
                SET status = 'fulfilled',
                    linked_task_id = ?,
                    handled_at = ?,
                    handled_by = ?
                WHERE id = ? AND status = 'pending'
                """,
                (task_id, created_at, current_user["id"], task_request["id"]),
            )
            if updated_request.rowcount != 1:
                raise HTTPException(status_code=409, detail="Task request update conflict.")
        task = connection.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
        return {"task": row_to_dict(task)}


@router.get("/tasks")
def list_tasks(
    relationship_id: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    mine: bool = Query(default=True),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    connection = get_connection()
    try:
        if relationship_id:
            rel_row = connection.execute("SELECT * FROM relationships WHERE id = ?", (relationship_id,)).fetchone()
            relationship = row_to_dict(rel_row)
            if not relationship:
                raise HTTPException(status_code=404, detail="Relationship not found.")
            my_role = ensure_relationship_member(relationship, current_user["id"])
            filters = ["t.relationship_id = ?"]
            params: list[Any] = [relationship_id]
            if mine and my_role == "puppy":
                filters.append("t.assigned_to = ?")
                params.append(current_user["id"])
            if status_filter:
                filters.append("t.status = ?")
                params.append(status_filter)
        else:
            filters = ["(t.created_by = ? OR t.assigned_to = ?)"]
            params = [current_user["id"], current_user["id"]]
            if status_filter:
                filters.append("t.status = ?")
                params.append(status_filter)

        rows = connection.execute(
            f"""
            SELECT t.*,
                   ts.note AS submission_note,
                   ts.media_type AS submission_media_type,
                   ts.media_url AS submission_media_url,
                   ts.submitted_at AS submission_submitted_at
            FROM tasks t
            LEFT JOIN task_submissions ts ON ts.task_id = t.id
            WHERE {' AND '.join(filters)}
            ORDER BY t.created_at DESC
            """,
            params,
        ).fetchall()
        tasks = [expire_task_if_needed(connection, row_to_dict(row)) for row in rows]
        connection.commit()
        return {"tasks": tasks}
    finally:
        connection.close()


@router.get("/tasks/{task_id}")
def get_task(task_id: str, current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    connection = get_connection()
    try:
        task = load_task_with_relationship(connection, task_id)
        ensure_relationship_member(task, current_user["id"])
        submission = row_to_dict(connection.execute("SELECT * FROM task_submissions WHERE task_id = ?", (task_id,)).fetchone())
        connection.commit()
        return {"task": task, "submission": submission}
    finally:
        connection.close()


@router.post("/tasks/{task_id}/submit")
def submit_task(
    task_id: str,
    note: str | None = Form(default=None),
    media_file: UploadFile | None = File(default=None),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    with transactional_connection() as connection:
        task = load_task_with_relationship(connection, task_id)
        if task["assigned_to"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Only assigned puppy can submit the task.")
        if task["relationship_status"] != "active":
            raise HTTPException(status_code=400, detail="Task relationship is not active.")
        if task["status"] == "expired":
            raise HTTPException(status_code=400, detail="Task has expired.")
        if task["status"] != "open":
            raise HTTPException(status_code=400, detail="Only open tasks can be submitted.")

        existing_submission = connection.execute("SELECT 1 FROM task_submissions WHERE task_id = ?", (task_id,)).fetchone()
        if existing_submission:
            raise HTTPException(status_code=409, detail="Task already has a submission.")

        submitted_at = utc_now()
        media_type = None
        media_url = None
        normalized_note = note.strip() if note else None
        if task["expected_submission_type"] == "image":
            if media_file is None:
                raise HTTPException(status_code=400, detail="Task requires an image submission.")
            media_type = "image"
            media_url = _store_submission_file(task_id, media_file, "image")
        elif task["expected_submission_type"] == "video":
            if media_file is None:
                raise HTTPException(status_code=400, detail="Task requires a video submission.")
            media_type = "video"
            media_url = _store_submission_file(task_id, media_file, "video")
        elif media_file is not None:
            raise HTTPException(status_code=400, detail="This task does not accept file uploads.")
        connection.execute(
            """
            INSERT INTO task_submissions (id, task_id, submitter_id, note, media_type, media_url, submitted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (str(uuid.uuid4()), task_id, current_user["id"], normalized_note, media_type, media_url, submitted_at),
        )
        connection.execute("UPDATE tasks SET status = 'submitted' WHERE id = ?", (task_id,))
        task["status"] = "submitted"
        submission = row_to_dict(connection.execute("SELECT * FROM task_submissions WHERE task_id = ?", (task_id,)).fetchone())
        return {"task": task, "submission": submission}


@router.post("/tasks/{task_id}/approve")
def approve_task(task_id: str, current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    with transactional_connection() as connection:
        task = load_task_with_relationship(connection, task_id)
        if task["owner_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Only owner can approve the task.")
        if task["relationship_status"] != "active":
            raise HTTPException(status_code=400, detail="Task relationship is not active.")
        if task["status"] != "submitted":
            raise HTTPException(status_code=400, detail="Only submitted tasks can be approved.")

        now = utc_now()
        reward_granted = _has_daily_reward_capacity(connection, task["owner_id"], task["puppy_id"], now)
        updated = connection.execute(
            """
            UPDATE tasks
            SET status = 'approved',
                approved_at = ?,
                reward_granted = ?
            WHERE id = ? AND status = 'submitted'
            """,
            (now, 1 if reward_granted else 0, task_id),
        )
        if updated.rowcount != 1:
            raise HTTPException(status_code=409, detail="Task approval conflict.")
        if reward_granted:
            connection.execute(
                "UPDATE wallets SET balance = balance + ?, updated_at = ? WHERE user_id = ?",
                (TASK_REWARD_COINS, now, task["owner_id"]),
            )
            connection.execute(
                "UPDATE wallets SET balance = balance + ?, updated_at = ? WHERE user_id = ?",
                (TASK_REWARD_COINS, now, task["assigned_to"]),
            )
        task["status"] = "approved"
        task["approved_at"] = now
        task["reward_granted"] = reward_granted
        wallet = get_wallet(connection, task["owner_id"])
        return {"task": task, "wallet": wallet}


@router.post("/tasks/{task_id}/reject")
def reject_task(
    task_id: str, payload: RejectTaskRequest, current_user: dict[str, Any] = Depends(get_current_user)
) -> dict[str, Any]:
    _ = payload
    with transactional_connection() as connection:
        task = load_task_with_relationship(connection, task_id)
        if task["owner_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Only owner can reject the task.")
        if task["relationship_status"] != "active":
            raise HTTPException(status_code=400, detail="Task relationship is not active.")
        if task["status"] != "submitted":
            raise HTTPException(status_code=400, detail="Only submitted tasks can be rejected.")
        connection.execute("UPDATE tasks SET status = 'rejected' WHERE id = ?", (task_id,))
        task["status"] = "rejected"
        return {"task": task}


@router.get("/wallet")
def wallet(current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    connection = get_connection()
    try:
        return {"wallet": get_wallet(connection, current_user["id"])}
    finally:
        connection.close()

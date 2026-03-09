from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.database import get_connection, transactional_connection
from app.dependencies import get_current_user
from app.realtime import publish_system_task_message_sync
from app.schemas import CreateTaskRequestRequest, RejectTaskRequestRequest
from app.services import ensure_relationship_member, load_task_request_with_relationship, row_to_dict, utc_now


router = APIRouter()


@router.get("/task-requests")
def list_task_requests(
    relationship_id: str = Query(...),
    status_filter: str | None = None,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    connection = get_connection()
    try:
        relationship_row = connection.execute("SELECT * FROM relationships WHERE id = ?", (relationship_id,)).fetchone()
        relationship = row_to_dict(relationship_row)
        if not relationship:
            raise HTTPException(status_code=404, detail="Relationship not found.")
        my_role = ensure_relationship_member(relationship, current_user["id"])

        filters = ["tr.relationship_id = ?"]
        params: list[Any] = [relationship_id]
        if my_role == "puppy":
            filters.append("tr.requester_id = ?")
            params.append(current_user["id"])
        if status_filter:
            filters.append("tr.status = ?")
            params.append(status_filter)

        rows = connection.execute(
            f"""
            SELECT tr.*
            FROM task_requests tr
            WHERE {' AND '.join(filters)}
            ORDER BY tr.created_at DESC
            """,
            params,
        ).fetchall()
        return {"task_requests": [row_to_dict(row) for row in rows]}
    finally:
        connection.close()


@router.post("/task-requests", status_code=status.HTTP_201_CREATED)
def create_task_request(
    payload: CreateTaskRequestRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    with transactional_connection() as connection:
        relationship_row = connection.execute("SELECT * FROM relationships WHERE id = ?", (payload.relationship_id,)).fetchone()
        relationship = row_to_dict(relationship_row)
        if not relationship:
            raise HTTPException(status_code=404, detail="Relationship not found.")
        my_role = ensure_relationship_member(relationship, current_user["id"])
        if my_role != "puppy":
            raise HTTPException(status_code=403, detail="Only puppy can request tasks.")
        if relationship["status"] != "active":
            raise HTTPException(status_code=400, detail="Task requests require an active relationship.")

        task_request_id = str(uuid.uuid4())
        created_at = utc_now()
        connection.execute(
            """
            INSERT INTO task_requests (
                id, relationship_id, requester_id, title, note, status, linked_task_id, created_at, handled_at, handled_by
            ) VALUES (?, ?, ?, ?, ?, 'pending', NULL, ?, NULL, NULL)
            """,
            (
                task_request_id,
                relationship["id"],
                current_user["id"],
                payload.title,
                payload.note,
                created_at,
            ),
        )
        task_request = connection.execute("SELECT * FROM task_requests WHERE id = ?", (task_request_id,)).fetchone()
        result = {"task_request": row_to_dict(task_request)}
    publish_system_task_message_sync(
        relationship_id=relationship["id"],
        action="task_request_created",
        task_id=None,
        title=payload.title,
        actor_id=current_user["id"],
        request_id=task_request_id,
    )
    return result


@router.post("/task-requests/{request_id}/reject")
def reject_task_request(
    request_id: str,
    payload: RejectTaskRequestRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    _ = payload
    with transactional_connection() as connection:
        task_request = load_task_request_with_relationship(connection, request_id)
        my_role = ensure_relationship_member(task_request, current_user["id"])
        if my_role != "owner":
            raise HTTPException(status_code=403, detail="Only owner can reject task requests.")
        if task_request["relationship_status"] != "active":
            raise HTTPException(status_code=400, detail="Task requests require an active relationship.")
        if task_request["status"] != "pending":
            raise HTTPException(status_code=400, detail="Task request is not pending.")

        handled_at = utc_now()
        connection.execute(
            """
            UPDATE task_requests
            SET status = 'rejected',
                handled_at = ?,
                handled_by = ?
            WHERE id = ? AND status = 'pending'
            """,
            (handled_at, current_user["id"], request_id),
        )
        task_request["status"] = "rejected"
        task_request["handled_at"] = handled_at
        task_request["handled_by"] = current_user["id"]
        result = {"task_request": task_request}
    publish_system_task_message_sync(
        relationship_id=task_request["relationship_id"],
        action="task_request_rejected",
        task_id=task_request.get("linked_task_id"),
        title=task_request["title"],
        actor_id=current_user["id"],
        request_id=request_id,
    )
    return result

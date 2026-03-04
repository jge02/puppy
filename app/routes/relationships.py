from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.database import get_connection, transactional_connection
from app.dependencies import get_current_user
from app.schemas import BindByInviteRequest
from app.services import ensure_relationship_member, get_current_relationship_for_user, row_to_dict, utc_now


router = APIRouter()


@router.post("/relationships/bind-by-invite", status_code=status.HTTP_201_CREATED)
def bind_by_invite(
    payload: BindByInviteRequest, current_user: dict[str, Any] = Depends(get_current_user)
) -> dict[str, Any]:
    with transactional_connection() as connection:
        target_user = connection.execute(
            """
            SELECT id, email, display_name, role_preference, invite_code, created_at
            FROM users
            WHERE invite_code = ?
            """,
            (payload.invite_code.upper(),),
        ).fetchone()
        target_user_data = row_to_dict(target_user)
        if not target_user_data:
            raise HTTPException(status_code=404, detail="Invite code not found.")
        if target_user_data["id"] == current_user["id"]:
            raise HTTPException(status_code=400, detail="Cannot bind using your own invite code.")

        current_role = current_user["role_preference"]
        target_role = target_user_data["role_preference"]
        if current_role == target_role:
            raise HTTPException(status_code=400, detail="Accounts with the same role cannot be matched.")

        owner_data = current_user if current_role == "owner" else target_user_data
        puppy_data = current_user if current_role == "puppy" else target_user_data

        if get_current_relationship_for_user(connection, current_user["id"]):
            raise HTTPException(status_code=409, detail="Current user already has an active or pending relationship.")
        if get_current_relationship_for_user(connection, target_user_data["id"]):
            raise HTTPException(status_code=409, detail="Invite code target already has an active or pending relationship.")

        relationship_id = str(uuid.uuid4())
        created_at = utc_now()
        connection.execute(
            """
            INSERT INTO relationships (id, owner_id, puppy_id, status, intimacy_score, created_at)
            VALUES (?, ?, ?, 'active', 0, ?)
            """,
            (relationship_id, owner_data["id"], puppy_data["id"], created_at),
        )
        relationship = connection.execute("SELECT * FROM relationships WHERE id = ?", (relationship_id,)).fetchone()
        return {
            "relationship": row_to_dict(relationship),
            "owner": owner_data,
            "puppy": puppy_data,
        }


@router.get("/relationships/current")
def current_relationship(current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    connection = get_connection()
    try:
        relationship = get_current_relationship_for_user(connection, current_user["id"])
        if not relationship:
            raise HTTPException(status_code=404, detail="No active or pending relationship.")
        my_role = ensure_relationship_member(relationship, current_user["id"])
        return {
            "relationship": {
                "id": relationship["id"],
                "status": relationship["status"],
                "intimacy_score": relationship["intimacy_score"],
                "created_at": relationship["created_at"],
            },
            "my_role_in_relationship": my_role,
            "counterpart": {
                "id": relationship["puppy_id"] if my_role == "owner" else relationship["owner_id"],
                "display_name": relationship["puppy_display_name"]
                if my_role == "owner"
                else relationship["owner_display_name"],
                "email": relationship["puppy_email"] if my_role == "owner" else relationship["owner_email"],
            },
        }
    finally:
        connection.close()


def update_relationship_status(relationship_id: str, new_status: str, user_id: str) -> dict[str, Any]:
    with transactional_connection() as connection:
        row = connection.execute("SELECT * FROM relationships WHERE id = ?", (relationship_id,)).fetchone()
        relationship = row_to_dict(row)
        if not relationship:
            raise HTTPException(status_code=404, detail="Relationship not found.")
        ensure_relationship_member(relationship, user_id)
        if relationship["status"] == "ended":
            raise HTTPException(status_code=400, detail="Ended relationship cannot be changed.")
        if new_status == "paused" and relationship["status"] != "active":
            raise HTTPException(status_code=400, detail="Only active relationships can be paused.")
        if new_status == "ended" and relationship["status"] not in {"pending", "active", "paused"}:
            raise HTTPException(status_code=400, detail="Relationship cannot be ended from current status.")
        connection.execute("UPDATE relationships SET status = ? WHERE id = ?", (new_status, relationship_id))
        relationship["status"] = new_status
        return {"relationship": relationship}


@router.post("/relationships/{relationship_id}/pause")
def pause_relationship(relationship_id: str, current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    return update_relationship_status(relationship_id, "paused", current_user["id"])


@router.post("/relationships/{relationship_id}/end")
def end_relationship(relationship_id: str, current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    return update_relationship_status(relationship_id, "ended", current_user["id"])

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.database import get_connection, transactional_connection
from app.dependencies import get_current_user
from app.schemas import LoginRequest, RegisterRequest, UpdateProfileRequest
from app.security import generate_token, hash_password, verify_password
from app.services import (
    encode_identity_labels,
    ensure_relationship_member,
    generate_unique_invite_code,
    get_current_relationship_for_user,
    get_wallet,
    normalize_user_profile,
    row_to_dict,
    utc_now,
)


router = APIRouter()


USER_SUMMARY_SELECT = """
SELECT id, email, display_name, role_preference, invite_code, created_at,
       gender, seeking_gender, sexual_orientation, identity_labels_json
FROM users
WHERE id = ?
"""


@router.post("/auth/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest) -> dict[str, Any]:
    with transactional_connection() as connection:
        existing = connection.execute("SELECT 1 FROM users WHERE email = ?", (payload.email,)).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="Email already registered.")

        user_id = str(uuid.uuid4())
        created_at = utc_now()
        invite_code = generate_unique_invite_code(connection)
        connection.execute(
            """
            INSERT INTO users (
                id, email, password_hash, display_name, role_preference, invite_code, created_at,
                gender, seeking_gender, sexual_orientation, identity_labels_json
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                payload.email,
                hash_password(payload.password),
                payload.display_name,
                payload.role_preference,
                invite_code,
                created_at,
                payload.gender,
                payload.seeking_gender,
                payload.sexual_orientation,
                encode_identity_labels(payload.identity_labels),
            ),
        )
        connection.execute(
            "INSERT INTO wallets (user_id, balance, updated_at) VALUES (?, 0, ?)",
            (user_id, created_at),
        )
        user = connection.execute(USER_SUMMARY_SELECT, (user_id,)).fetchone()
        wallet = get_wallet(connection, user_id)

    return {
        "token": generate_token(user_id),
        "user": normalize_user_profile(row_to_dict(user)),
        "wallet": wallet,
    }


@router.post("/auth/login")
def login(payload: LoginRequest) -> dict[str, Any]:
    connection = get_connection()
    try:
        row = connection.execute("SELECT * FROM users WHERE email = ?", (payload.email,)).fetchone()
        user = row_to_dict(row)
        if not user or not verify_password(payload.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password.")
        wallet = get_wallet(connection, user["id"])
        summary = normalize_user_profile(
            {
                "id": user["id"],
                "email": user["email"],
                "display_name": user["display_name"],
                "role_preference": user["role_preference"],
                "invite_code": user["invite_code"],
                "created_at": user["created_at"],
                "gender": user.get("gender"),
                "seeking_gender": user.get("seeking_gender"),
                "sexual_orientation": user.get("sexual_orientation"),
                "identity_labels_json": user.get("identity_labels_json"),
            }
        )
        return {
            "token": generate_token(user["id"]),
            "user": summary,
            "wallet": wallet,
        }
    finally:
        connection.close()


@router.get("/me")
def me(current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    connection = get_connection()
    try:
        relationship = get_current_relationship_for_user(connection, current_user["id"])
        wallet = get_wallet(connection, current_user["id"])
        summary = None
        if relationship:
            my_role = ensure_relationship_member(relationship, current_user["id"])
            summary = {
                "id": relationship["id"],
                "status": relationship["status"],
                "my_role_in_relationship": my_role,
                "counterpart": {
                    "id": relationship["puppy_id"] if my_role == "owner" else relationship["owner_id"],
                    "display_name": relationship["puppy_display_name"]
                    if my_role == "owner"
                    else relationship["owner_display_name"],
                    "email": relationship["puppy_email"] if my_role == "owner" else relationship["owner_email"],
                },
            }
        return {"user": current_user, "wallet": wallet, "current_relationship": summary}
    finally:
        connection.close()


@router.patch("/me/profile")
def update_profile(payload: UpdateProfileRequest, current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    with transactional_connection() as connection:
        updates: list[str] = []
        params: list[Any] = []

        if payload.display_name is not None:
            updates.append("display_name = ?")
            params.append(payload.display_name.strip())
        if payload.gender is not None:
            updates.append("gender = ?")
            params.append(payload.gender)
        if payload.seeking_gender is not None:
            updates.append("seeking_gender = ?")
            params.append(payload.seeking_gender)
        if payload.sexual_orientation is not None:
            updates.append("sexual_orientation = ?")
            params.append(payload.sexual_orientation)
        if payload.identity_labels is not None:
            updates.append("identity_labels_json = ?")
            params.append(encode_identity_labels(payload.identity_labels))

        if updates:
            params.append(current_user["id"])
            connection.execute(
                f"UPDATE users SET {', '.join(updates)} WHERE id = ?",
                tuple(params),
            )

        row = connection.execute(USER_SUMMARY_SELECT, (current_user["id"],)).fetchone()
        user = normalize_user_profile(row_to_dict(row))
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")
        return {"user": user}

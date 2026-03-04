from __future__ import annotations

from fastapi import Depends, Header, HTTPException, status

from app.database import get_connection
from app.security import verify_token
from app.services import row_to_dict


def get_bearer_token(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token.")
    return authorization.split(" ", 1)[1]


def get_current_user(token: str = Depends(get_bearer_token)) -> dict[str, str]:
    user_id = verify_token(token)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token.")
    connection = get_connection()
    try:
        row = connection.execute(
            """
            SELECT id, email, display_name, role_preference, invite_code, created_at
            FROM users
            WHERE id = ?
            """,
            (user_id,),
        ).fetchone()
        user = row_to_dict(row)
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")
        return user
    finally:
        connection.close()

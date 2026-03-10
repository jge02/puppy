from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from app.database import get_connection
from app.dependencies import require_admin_token
from app.services import utc_now


router = APIRouter()


@router.get("/admin/stats")
def admin_stats(_: str = Depends(require_admin_token)) -> dict[str, Any]:
    connection = get_connection()
    try:
        total_users = connection.execute("SELECT COUNT(*) AS count FROM users").fetchone()["count"]
        bound_users = connection.execute(
            """
            SELECT COUNT(*) AS count
            FROM (
                SELECT owner_id AS user_id
                FROM relationships
                WHERE status IN ('pending', 'active', 'paused')
                UNION
                SELECT puppy_id AS user_id
                FROM relationships
                WHERE status IN ('pending', 'active', 'paused')
            )
            """
        ).fetchone()["count"]
        relationship_rows = connection.execute(
            """
            SELECT status, COUNT(*) AS count
            FROM relationships
            GROUP BY status
            """
        ).fetchall()
        relationship_counts = {row["status"]: row["count"] for row in relationship_rows}
        return {
            "generated_at": utc_now(),
            "users": {
                "total_registered": total_users,
                "bound": bound_users,
                "unbound": max(total_users - bound_users, 0),
            },
            "relationships": {
                "total": sum(relationship_counts.values()),
                "by_status": relationship_counts,
            },
        }
    finally:
        connection.close()

from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query

from app.database import get_connection
from app.dependencies import get_current_user
from app.services import get_current_relationship_for_user


router = APIRouter()

LeaderboardType = Literal["weekly_tasks", "streak", "collection"]


@router.get("/social/leaderboard")
def get_leaderboard(
    type: LeaderboardType = Query(default="weekly_tasks"),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    connection = get_connection()
    try:
        relationship = get_current_relationship_for_user(connection, current_user["id"])
        if not relationship or relationship["status"] != "active":
            raise HTTPException(status_code=400, detail="No active relationship.")

        rel_id = relationship["id"]
        owner_id = relationship["owner_id"]
        puppy_id = relationship["puppy_id"]
        both_ids = (owner_id, puppy_id)

        entries = []
        if type == "weekly_tasks":
            rows = connection.execute(
                """
                SELECT u.id, u.display_name,
                       COUNT(go.id) AS score
                FROM users u
                LEFT JOIN growth_orbs go
                    ON go.puppy_id = u.id
                    AND go.relationship_id = ?
                    AND date(go.created_at) >= date('now', '-6 days')
                WHERE u.id IN (?, ?)
                GROUP BY u.id
                ORDER BY score DESC
                """,
                (rel_id, owner_id, puppy_id),
            ).fetchall()
            label = "本周完成任务数"
        elif type == "streak":
            # compute streak for each user in pair
            rows_raw = connection.execute(
                """
                SELECT u.id, u.display_name
                FROM users u WHERE u.id IN (?, ?)
                """,
                both_ids,
            ).fetchall()
            def compute_streak(user_id: str) -> int:
                day_rows = connection.execute(
                    """
                    SELECT DISTINCT date(created_at) AS day
                    FROM growth_orbs
                    WHERE relationship_id = ? AND puppy_id = ?
                    ORDER BY day DESC
                    """,
                    (rel_id, user_id),
                ).fetchall()
                from datetime import date, timedelta
                streak = 0
                check = date.today()
                for dr in day_rows:
                    d = date.fromisoformat(dr[0])
                    if d == check:
                        streak += 1
                        check -= timedelta(days=1)
                    elif d < check:
                        break
                return streak

            entries = [
                {"user_id": r[0], "display_name": r[1], "score": compute_streak(r[0])}
                for r in rows_raw
            ]
            entries.sort(key=lambda x: x["score"], reverse=True)
            for i, e in enumerate(entries):
                e["rank"] = i + 1
            label = "连续完成天数"
            return {"type": type, "label": label, "entries": entries}
        else:  # collection
            rows = connection.execute(
                """
                SELECT u.id, u.display_name,
                       COUNT(go.id) AS score
                FROM users u
                LEFT JOIN growth_orbs go
                    ON go.puppy_id = u.id
                    AND go.relationship_id = ?
                WHERE u.id IN (?, ?)
                GROUP BY u.id
                ORDER BY score DESC
                """,
                (rel_id, owner_id, puppy_id),
            ).fetchall()
            label = "瓶子总球数"

        entries = [
            {"user_id": r[0], "display_name": r[1], "score": r[2], "rank": i + 1}
            for i, r in enumerate(rows)
        ]
        return {"type": type, "label": label, "entries": entries}
    finally:
        connection.close()


@router.get("/social/showcase")
def get_showcase(current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    connection = get_connection()
    try:
        relationship = get_current_relationship_for_user(connection, current_user["id"])
        if not relationship or relationship["status"] != "active":
            raise HTTPException(status_code=400, detail="No active relationship.")

        rel_id = relationship["id"]
        puppy_id = relationship["puppy_id"]

        total_orbs = connection.execute(
            "SELECT COUNT(*) FROM growth_orbs WHERE relationship_id = ?",
            (rel_id,),
        ).fetchone()[0]

        from datetime import date, timedelta
        day_rows = connection.execute(
            """
            SELECT DISTINCT date(created_at) AS day
            FROM growth_orbs
            WHERE relationship_id = ? AND puppy_id = ?
            ORDER BY day DESC
            """,
            (rel_id, puppy_id),
        ).fetchall()
        streak = 0
        check = date.today()
        for dr in day_rows:
            d = date.fromisoformat(dr[0])
            if d == check:
                streak += 1
                check -= timedelta(days=1)
            elif d < check:
                break

        recent_orbs = connection.execute(
            """
            SELECT id, orb_type, is_rare, task_title, created_at
            FROM growth_orbs
            WHERE relationship_id = ?
            ORDER BY created_at DESC
            LIMIT 5
            """,
            (rel_id,),
        ).fetchall()

        equipped_row = connection.execute(
            "SELECT * FROM user_equipped_cosmetics WHERE user_id = ?",
            (puppy_id,),
        ).fetchone()
        equipped = dict(equipped_row) if equipped_row else {}

        puppy_row = connection.execute(
            "SELECT display_name FROM users WHERE id = ?",
            (puppy_id,),
        ).fetchone()

        return {
            "relationship_id": rel_id,
            "puppy_id": puppy_id,
            "puppy_display_name": puppy_row[0] if puppy_row else "",
            "total_orbs": total_orbs,
            "streak_days": streak,
            "bottle_theme_id": equipped.get("bottle_theme_id") or "bottle_glass",
            "title_item_id": equipped.get("title_item_id"),
            "recent_orbs": [dict(r) for r in recent_orbs],
        }
    finally:
        connection.close()

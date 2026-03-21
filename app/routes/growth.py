from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from app.database import get_connection
from app.dependencies import get_current_user
from app.services import ensure_relationship_member, row_to_dict


router = APIRouter()

BOTTLE_LEVEL_THRESHOLDS = [0, 10, 30, 60, 100, 150, 210, 280, 360, 450]


def _compute_bottle_level(total_orbs: int) -> int:
    level = 0
    for i, threshold in enumerate(BOTTLE_LEVEL_THRESHOLDS):
        if total_orbs >= threshold:
            level = i
    return level


@router.get("/growth/summary")
def get_growth_summary(
    relationship_id: str = Query(...),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    connection = get_connection()
    try:
        rel_row = connection.execute("SELECT * FROM relationships WHERE id = ?", (relationship_id,)).fetchone()
        relationship = row_to_dict(rel_row)
        if not relationship:
            raise HTTPException(status_code=404, detail="Relationship not found.")
        ensure_relationship_member(relationship, current_user["id"])

        orb_rows = connection.execute(
            """
            SELECT id, task_id, orb_type, is_rare, task_title, created_at
            FROM growth_orbs
            WHERE relationship_id = ?
            ORDER BY created_at ASC
            """,
            (relationship_id,),
        ).fetchall()
        orbs = [dict(row) for row in orb_rows]
        total_orbs = len(orbs)

        today_count = connection.execute(
            """
            SELECT COUNT(*) FROM growth_orbs
            WHERE relationship_id = ?
              AND date(created_at) = date('now')
            """,
            (relationship_id,),
        ).fetchone()[0]

        # streak: consecutive days with at least one approved task
        streak_rows = connection.execute(
            """
            SELECT DISTINCT date(created_at) AS day
            FROM growth_orbs
            WHERE relationship_id = ?
            ORDER BY day DESC
            """,
            (relationship_id,),
        ).fetchall()
        streak_days = 0
        from datetime import date, timedelta
        check_date = date.today()
        for row in streak_rows:
            row_date = date.fromisoformat(row[0])
            if row_date == check_date:
                streak_days += 1
                check_date -= timedelta(days=1)
            elif row_date < check_date:
                break

        bottle_level = _compute_bottle_level(total_orbs)

        equipped_row = connection.execute(
            "SELECT * FROM user_equipped_cosmetics WHERE user_id = ?",
            (current_user["id"],),
        ).fetchone()
        equipped = dict(equipped_row) if equipped_row else {}

        return {
            "total_orbs": total_orbs,
            "today_completed": today_count,
            "streak_days": streak_days,
            "current_bottle_level": bottle_level,
            "equipped_bottle_theme_id": equipped.get("bottle_theme_id") or "bottle_glass",
            "equipped_orb_skin_id": equipped.get("orb_skin_id") or "orb_bubble",
            "equipped_dashboard_bg_id": equipped.get("dashboard_bg_id") or "bg_default",
            "equipped_entry_animation_id": equipped.get("entry_animation_id") or "anim_default",
            "orbs": orbs,
        }
    finally:
        connection.close()

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.database import get_connection, transactional_connection
from app.dependencies import get_current_user
from app.services import row_to_dict, utc_now


router = APIRouter()

EQUIPPABLE_TYPES = {
    "bottle_theme": "bottle_theme_id",
    "orb_skin": "orb_skin_id",
    "dashboard_bg": "dashboard_bg_id",
    "entry_animation": "entry_animation_id",
    "avatar_frame": "avatar_frame_id",
    "title_item": "title_item_id",
}


class PurchaseRequest(BaseModel):
    item_id: str


class EquipRequest(BaseModel):
    item_id: str


@router.get("/shop/items")
def list_shop_items(current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    connection = get_connection()
    try:
        rows = connection.execute(
            "SELECT * FROM shop_items WHERE is_active = 1 ORDER BY item_type, sort_order"
        ).fetchall()
        owned_rows = connection.execute(
            "SELECT item_id FROM user_inventory WHERE user_id = ?",
            (current_user["id"],),
        ).fetchall()
        owned_ids = {row[0] for row in owned_rows}
        items = []
        for row in rows:
            item = dict(row)
            item["owned"] = bool(item.get("is_default")) or item["id"] in owned_ids
            items.append(item)
        return {"items": items}
    finally:
        connection.close()


@router.get("/shop/inventory")
def get_inventory(current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    connection = get_connection()
    try:
        rows = connection.execute(
            """
            SELECT si.*, ui.purchased_at
            FROM user_inventory ui
            JOIN shop_items si ON si.id = ui.item_id
            WHERE ui.user_id = ?
            ORDER BY ui.purchased_at DESC
            """,
            (current_user["id"],),
        ).fetchall()
        equipped_row = connection.execute(
            "SELECT * FROM user_equipped_cosmetics WHERE user_id = ?",
            (current_user["id"],),
        ).fetchone()
        equipped = dict(equipped_row) if equipped_row else {}
        items = []
        for row in rows:
            item = dict(row)
            col = EQUIPPABLE_TYPES.get(item["item_type"])
            item["equipped"] = bool(col and equipped.get(col) == item["id"])
            items.append(item)
        return {"inventory": items, "equipped": equipped}
    finally:
        connection.close()


@router.post("/shop/purchase")
def purchase_item(
    payload: PurchaseRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    with transactional_connection() as connection:
        item_row = connection.execute(
            "SELECT * FROM shop_items WHERE id = ? AND is_active = 1",
            (payload.item_id,),
        ).fetchone()
        if not item_row:
            raise HTTPException(status_code=404, detail="Item not found.")
        item = dict(item_row)

        already_owned = connection.execute(
            "SELECT 1 FROM user_inventory WHERE user_id = ? AND item_id = ?",
            (current_user["id"], payload.item_id),
        ).fetchone()
        if already_owned:
            raise HTTPException(status_code=409, detail="Item already owned.")

        if item["price_coins"] > 0:
            wallet_row = connection.execute(
                "SELECT balance FROM wallets WHERE user_id = ?",
                (current_user["id"],),
            ).fetchone()
            if not wallet_row or wallet_row[0] < item["price_coins"]:
                raise HTTPException(status_code=400, detail="Insufficient coins.")
            now = utc_now()
            connection.execute(
                "UPDATE wallets SET balance = balance - ?, updated_at = ? WHERE user_id = ?",
                (item["price_coins"], now, current_user["id"]),
            )

        now = utc_now()
        connection.execute(
            "INSERT INTO user_inventory (id, user_id, item_id, purchased_at) VALUES (?, ?, ?, ?)",
            (str(uuid.uuid4()), current_user["id"], payload.item_id, now),
        )
        wallet_row = connection.execute(
            "SELECT balance FROM wallets WHERE user_id = ?",
            (current_user["id"],),
        ).fetchone()
        return {
            "item": item,
            "wallet_balance": wallet_row[0] if wallet_row else 0,
        }


@router.post("/shop/equip")
def equip_item(
    payload: EquipRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    with transactional_connection() as connection:
        item_row = connection.execute(
            "SELECT * FROM shop_items WHERE id = ? AND is_active = 1",
            (payload.item_id,),
        ).fetchone()
        if not item_row:
            raise HTTPException(status_code=404, detail="Item not found.")
        item = dict(item_row)

        owned = connection.execute(
            "SELECT 1 FROM user_inventory WHERE user_id = ? AND item_id = ?",
            (current_user["id"], payload.item_id),
        ).fetchone()
        if not owned and not item.get("is_default"):
            raise HTTPException(status_code=403, detail="Item not owned.")

        col = EQUIPPABLE_TYPES.get(item["item_type"])
        if not col:
            raise HTTPException(status_code=400, detail="Item type cannot be equipped.")

        now = utc_now()
        existing = connection.execute(
            "SELECT 1 FROM user_equipped_cosmetics WHERE user_id = ?",
            (current_user["id"],),
        ).fetchone()
        if existing:
            connection.execute(
                f"UPDATE user_equipped_cosmetics SET {col} = ?, updated_at = ? WHERE user_id = ?",
                (payload.item_id, now, current_user["id"]),
            )
        else:
            connection.execute(
                f"INSERT INTO user_equipped_cosmetics (user_id, {col}, updated_at) VALUES (?, ?, ?)",
                (current_user["id"], payload.item_id, now),
            )
        equipped_row = connection.execute(
            "SELECT * FROM user_equipped_cosmetics WHERE user_id = ?",
            (current_user["id"],),
        ).fetchone()
        return {"equipped": dict(equipped_row) if equipped_row else {}}

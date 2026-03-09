from __future__ import annotations

import asyncio
import json
import uuid
from collections import defaultdict
from collections.abc import Awaitable
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, WebSocket

from app.database import get_connection, transactional_connection
from app.services import ensure_relationship_member, row_to_dict, utc_now


def _to_json_payload(content: dict[str, Any]) -> str:
    return json.dumps(content, separators=(",", ":"), ensure_ascii=False)


def _parse_json_payload(raw: str) -> dict[str, Any]:
    try:
        parsed = json.loads(raw)
    except Exception:
        return {"raw": raw}
    return parsed if isinstance(parsed, dict) else {"raw": parsed}


def _serialize_chat_message(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "relationship_id": row["relationship_id"],
        "sender_id": row["sender_id"],
        "kind": row["kind"],
        "content": _parse_json_payload(row["content_json"]),
        "created_at": row["created_at"],
        "client_msg_id": row["client_msg_id"],
    }


class ChatConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, dict[str, set[WebSocket]]] = defaultdict(lambda: defaultdict(set))
        self._lock = asyncio.Lock()
        self._loop: asyncio.AbstractEventLoop | None = None

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    async def connect(self, relationship_id: str, user_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections[relationship_id][user_id].add(websocket)

    async def disconnect(self, relationship_id: str, user_id: str, websocket: WebSocket) -> None:
        async with self._lock:
            users = self._connections.get(relationship_id)
            if not users:
                return
            sockets = users.get(user_id)
            if not sockets:
                return
            sockets.discard(websocket)
            if not sockets:
                users.pop(user_id, None)
            if not users:
                self._connections.pop(relationship_id, None)

    async def send_to_user(self, relationship_id: str, user_id: str, payload: dict[str, Any]) -> None:
        async with self._lock:
            sockets = list(self._connections.get(relationship_id, {}).get(user_id, set()))
        stale: list[WebSocket] = []
        for socket in sockets:
            try:
                await socket.send_json(payload)
            except Exception:
                stale.append(socket)
        for socket in stale:
            await self.disconnect(relationship_id, user_id, socket)

    async def broadcast(self, relationship_id: str, payload: dict[str, Any]) -> None:
        async with self._lock:
            target_items = [
                (user_id, list(sockets))
                for user_id, sockets in self._connections.get(relationship_id, {}).items()
            ]
        for user_id, sockets in target_items:
            stale: list[WebSocket] = []
            for socket in sockets:
                try:
                    await socket.send_json(payload)
                except Exception:
                    stale.append(socket)
            for socket in stale:
                await self.disconnect(relationship_id, user_id, socket)

    def run_background(self, awaitable: Awaitable[Any]) -> None:
        if self._loop is None:
            try:
                asyncio.run(awaitable)
            except Exception:
                pass
            return
        asyncio.run_coroutine_threadsafe(awaitable, self._loop)


chat_manager = ChatConnectionManager()


def ensure_relationship_access(relationship_id: str, user_id: str) -> dict[str, Any]:
    connection = get_connection()
    try:
        relationship_row = connection.execute("SELECT * FROM relationships WHERE id = ?", (relationship_id,)).fetchone()
        relationship = row_to_dict(relationship_row)
        if not relationship:
            raise HTTPException(status_code=404, detail="Relationship not found.")
        ensure_relationship_member(relationship, user_id)
        return relationship
    finally:
        connection.close()


def _resolve_message_rowid(connection: Any, relationship_id: str, message_id: str | None) -> int:
    if not message_id:
        return 0
    row = connection.execute(
        "SELECT rowid FROM chat_messages WHERE id = ? AND relationship_id = ?",
        (message_id, relationship_id),
    ).fetchone()
    if not row:
        return 0
    return int(row[0])


def unread_count_for_user(connection: Any, relationship_id: str, user_id: str) -> int:
    read_row = connection.execute(
        """
        SELECT last_read_message_id
        FROM chat_reads
        WHERE relationship_id = ? AND user_id = ?
        """,
        (relationship_id, user_id),
    ).fetchone()
    last_read_message_id = read_row["last_read_message_id"] if read_row else None
    base_rowid = _resolve_message_rowid(connection, relationship_id, last_read_message_id)
    row = connection.execute(
        """
        SELECT COUNT(*) AS count
        FROM chat_messages
        WHERE relationship_id = ?
          AND rowid > ?
          AND (sender_id IS NULL OR sender_id <> ?)
        """,
        (relationship_id, base_rowid, user_id),
    ).fetchone()
    return int(row["count"] if row else 0)


def create_chat_message(
    connection: Any,
    relationship_id: str,
    sender_id: str | None,
    kind: str,
    content: dict[str, Any],
    client_msg_id: str | None = None,
    created_at: str | None = None,
) -> dict[str, Any]:
    message_id = str(uuid.uuid4())
    created = created_at or utc_now()
    connection.execute(
        """
        INSERT INTO chat_messages (
            id, relationship_id, sender_id, kind, content_json, created_at, client_msg_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (message_id, relationship_id, sender_id, kind, _to_json_payload(content), created, client_msg_id),
    )
    row = connection.execute(
        """
        SELECT id, relationship_id, sender_id, kind, content_json, created_at, client_msg_id
        FROM chat_messages
        WHERE id = ?
        """,
        (message_id,),
    ).fetchone()
    message = row_to_dict(row)
    if not message:
        raise HTTPException(status_code=500, detail="Unable to create chat message.")
    return _serialize_chat_message(message)


def upsert_chat_read(
    connection: Any,
    relationship_id: str,
    user_id: str,
    last_read_message_id: str,
) -> dict[str, Any]:
    row = connection.execute(
        "SELECT 1 FROM chat_messages WHERE id = ? AND relationship_id = ?",
        (last_read_message_id, relationship_id),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Message not found in relationship.")

    now = utc_now()
    connection.execute(
        """
        INSERT INTO chat_reads (relationship_id, user_id, last_read_message_id, last_read_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(relationship_id, user_id) DO UPDATE SET
            last_read_message_id = excluded.last_read_message_id,
            last_read_at = excluded.last_read_at
        """,
        (relationship_id, user_id, last_read_message_id, now),
    )
    return {
        "relationship_id": relationship_id,
        "user_id": user_id,
        "last_read_message_id": last_read_message_id,
        "last_read_at": now,
    }


def list_chat_messages(
    relationship_id: str,
    before: str | None,
    limit: int,
) -> list[dict[str, Any]]:
    connection = get_connection()
    try:
        before_rowid = _resolve_message_rowid(connection, relationship_id, before)
        if before and before_rowid == 0:
            raise HTTPException(status_code=404, detail="Cursor message not found.")

        rows = connection.execute(
            """
            SELECT id, relationship_id, sender_id, kind, content_json, created_at, client_msg_id
            FROM chat_messages
            WHERE relationship_id = ?
              AND (? = 0 OR rowid < ?)
            ORDER BY rowid DESC
            LIMIT ?
            """,
            (relationship_id, before_rowid, before_rowid, limit),
        ).fetchall()
        items = []
        for row in rows:
            message_row = row_to_dict(row)
            if message_row:
                items.append(_serialize_chat_message(message_row))
        items.reverse()
        return items
    finally:
        connection.close()


def get_chat_read_state(relationship_id: str, user_id: str) -> dict[str, Any]:
    connection = get_connection()
    try:
        read = connection.execute(
            """
            SELECT last_read_message_id, last_read_at
            FROM chat_reads
            WHERE relationship_id = ? AND user_id = ?
            """,
            (relationship_id, user_id),
        ).fetchone()
        state = row_to_dict(read) or {"last_read_message_id": None, "last_read_at": None}
        return {
            "relationship_id": relationship_id,
            "last_read_message_id": state["last_read_message_id"],
            "last_read_at": state["last_read_at"],
            "unread_count": unread_count_for_user(connection, relationship_id, user_id),
        }
    finally:
        connection.close()


async def publish_message_events(relationship_id: str, message: dict[str, Any]) -> None:
    await chat_manager.broadcast(
        relationship_id,
        {
            "type": "chat.message.new",
            "message": message,
        },
    )

    connection = get_connection()
    try:
        relationship_row = connection.execute(
            "SELECT owner_id, puppy_id FROM relationships WHERE id = ?",
            (relationship_id,),
        ).fetchone()
        relationship = row_to_dict(relationship_row)
        if not relationship:
            return
        participants = [relationship["owner_id"], relationship["puppy_id"]]
        for user_id in participants:
            unread = unread_count_for_user(connection, relationship_id, user_id)
            await chat_manager.send_to_user(
                relationship_id,
                user_id,
                {
                    "type": "chat.unread.count",
                    "relationship_id": relationship_id,
                    "user_id": user_id,
                    "unread_count": unread,
                },
            )
    finally:
        connection.close()


def publish_system_task_message_sync(
    relationship_id: str,
    action: str,
    task_id: str | None,
    title: str,
    actor_id: str,
    request_id: str | None = None,
) -> None:
    with transactional_connection() as connection:
        payload: dict[str, Any] = {
            "action": action,
            "task_id": task_id,
            "title": title,
            "actor_id": actor_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        if request_id:
            payload["request_id"] = request_id
        message = create_chat_message(
            connection=connection,
            relationship_id=relationship_id,
            sender_id=None,
            kind="system_task",
            content=payload,
        )
    chat_manager.run_background(publish_message_events(relationship_id, message))

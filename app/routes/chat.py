from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect

from app.dependencies import get_current_user
from app.realtime import (
    chat_manager,
    create_chat_message,
    ensure_relationship_access,
    get_chat_read_state,
    list_chat_messages,
    publish_message_events,
    unread_count_for_user,
    upsert_chat_read,
)
from app.schemas import ChatReadRequest
from app.security import verify_token
from app.database import get_connection, transactional_connection
from app.services import normalize_user_profile, row_to_dict


router = APIRouter()


def _resolve_ws_user(token: str | None) -> dict[str, Any] | None:
    if not token:
        return None
    user_id = verify_token(token)
    if not user_id:
        return None

    connection = get_connection()
    try:
        row = connection.execute(
            """
            SELECT id, email, display_name, role_preference, invite_code, created_at,
                   gender, seeking_gender, sexual_orientation, identity_labels_json
            FROM users
            WHERE id = ?
            """,
            (user_id,),
        ).fetchone()
        return normalize_user_profile(row_to_dict(row))
    finally:
        connection.close()


@router.get("/chat/messages")
def get_chat_messages(
    relationship_id: str = Query(...),
    before: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    ensure_relationship_access(relationship_id, current_user["id"])
    messages = list_chat_messages(relationship_id=relationship_id, before=before, limit=limit)
    return {"messages": messages}


@router.get("/chat/unread")
def get_chat_unread(
    relationship_id: str = Query(...),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    ensure_relationship_access(relationship_id, current_user["id"])
    return get_chat_read_state(relationship_id=relationship_id, user_id=current_user["id"])


@router.post("/chat/read")
def mark_chat_read(
    payload: ChatReadRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    ensure_relationship_access(payload.relationship_id, current_user["id"])
    with transactional_connection() as connection:
        read_state = upsert_chat_read(
            connection=connection,
            relationship_id=payload.relationship_id,
            user_id=current_user["id"],
            last_read_message_id=payload.message_id,
        )
        unread = unread_count_for_user(connection, payload.relationship_id, current_user["id"])

    chat_manager.run_background(
        chat_manager.broadcast(
            payload.relationship_id,
            {
                "type": "chat.read.updated",
                **read_state,
            },
        )
    )
    chat_manager.run_background(
        chat_manager.send_to_user(
            payload.relationship_id,
            current_user["id"],
            {
                "type": "chat.unread.count",
                "relationship_id": payload.relationship_id,
                "user_id": current_user["id"],
                "unread_count": unread,
            },
        )
    )
    return {**read_state, "unread_count": unread}


@router.websocket("/ws/relationships/{relationship_id}")
async def chat_websocket(websocket: WebSocket, relationship_id: str) -> None:
    token = websocket.query_params.get("token")
    user = _resolve_ws_user(token)
    if not user:
        await websocket.accept()
        await websocket.send_json({"type": "error", "detail": "Invalid token."})
        await websocket.close(code=1008)
        return

    try:
        ensure_relationship_access(relationship_id, user["id"])
    except HTTPException as exc:
        await websocket.accept()
        await websocket.send_json({"type": "error", "detail": exc.detail})
        await websocket.close(code=1008)
        return

    await chat_manager.connect(relationship_id, user["id"], websocket)
    try:
        unread_state = get_chat_read_state(relationship_id=relationship_id, user_id=user["id"])
        await websocket.send_json(
            {
                "type": "chat.unread.count",
                "relationship_id": relationship_id,
                "user_id": user["id"],
                "unread_count": unread_state["unread_count"],
            }
        )

        while True:
            incoming = await websocket.receive_json()
            if not isinstance(incoming, dict):
                await websocket.send_json({"type": "error", "detail": "Invalid event payload."})
                continue
            event_type = incoming.get("type")

            if event_type == "chat.message.send":
                text = str(incoming.get("text", "")).strip()
                if not text:
                    await websocket.send_json({"type": "error", "detail": "Message text cannot be empty."})
                    continue
                if len(text) > 2000:
                    await websocket.send_json({"type": "error", "detail": "Message text is too long."})
                    continue
                client_msg_id = incoming.get("client_msg_id")
                if client_msg_id is not None and not isinstance(client_msg_id, str):
                    await websocket.send_json({"type": "error", "detail": "Invalid client message id."})
                    continue

                with transactional_connection() as connection:
                    message = create_chat_message(
                        connection=connection,
                        relationship_id=relationship_id,
                        sender_id=user["id"],
                        kind="text",
                        content={"text": text},
                        client_msg_id=client_msg_id,
                    )

                await publish_message_events(relationship_id, message)
                if client_msg_id:
                    await chat_manager.send_to_user(
                        relationship_id,
                        user["id"],
                        {
                            "type": "chat.message.ack",
                            "client_msg_id": client_msg_id,
                            "message_id": message["id"],
                            "created_at": message["created_at"],
                        },
                    )
                continue

            if event_type == "chat.read.update":
                message_id = incoming.get("message_id")
                if not isinstance(message_id, str) or not message_id.strip():
                    await websocket.send_json({"type": "error", "detail": "message_id is required."})
                    continue
                try:
                    with transactional_connection() as connection:
                        read_state = upsert_chat_read(
                            connection=connection,
                            relationship_id=relationship_id,
                            user_id=user["id"],
                            last_read_message_id=message_id,
                        )
                        unread = unread_count_for_user(connection, relationship_id, user["id"])
                except HTTPException as exc:
                    await websocket.send_json({"type": "error", "detail": exc.detail})
                    continue

                await chat_manager.broadcast(
                    relationship_id,
                    {
                        "type": "chat.read.updated",
                        **read_state,
                    },
                )
                await chat_manager.send_to_user(
                    relationship_id,
                    user["id"],
                    {
                        "type": "chat.unread.count",
                        "relationship_id": relationship_id,
                        "user_id": user["id"],
                        "unread_count": unread,
                    },
                )
                continue

            await websocket.send_json({"type": "error", "detail": "Unsupported event type."})
    except WebSocketDisconnect:
        await chat_manager.disconnect(relationship_id, user["id"], websocket)
    except Exception:
        await chat_manager.disconnect(relationship_id, user["id"], websocket)

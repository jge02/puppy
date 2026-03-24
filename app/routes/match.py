from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, UploadFile, WebSocket, WebSocketDisconnect, status

from app.database import BASE_DIR, get_connection, transactional_connection
from app.dependencies import get_current_user
from app.realtime import notification_manager
from app.schemas import (
    BlockUserRequest,
    CreateMatchPostRequest,
    CreateMatchRequestRequest,
    HandleMatchRequestRequest,
    ReportMatchRequest,
    UpdateMatchPostRequest,
)
from app.security import verify_token
from app.services import decode_identity_labels, get_current_relationship_for_user, normalize_user_profile, row_to_dict, utc_now


router = APIRouter()
DEFAULT_TIMEZONE = "America/Vancouver"
DAILY_INVITE_LIMIT = 5
MATCH_POST_UPLOADS_DIR = BASE_DIR / "uploads" / "match-posts"


def _raise_api_error(status_code: int, code: str, message: str) -> None:
    raise HTTPException(status_code=status_code, detail={"code": code, "message": message})


def _resolve_timezone(tz_name: str | None):
    if tz_name:
        try:
            return ZoneInfo(tz_name)
        except ZoneInfoNotFoundError:
            pass
    try:
        return ZoneInfo(DEFAULT_TIMEZONE)
    except ZoneInfoNotFoundError:
        # Windows/Python may miss IANA tz database when tzdata is not installed.
        # Fallback to UTC so invite flow keeps working instead of crashing.
        return timezone.utc


def _daily_window_utc(tz_name: str | None) -> tuple[str, str]:
    tz = _resolve_timezone(tz_name)
    now_local = datetime.now(tz)
    start_local = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
    end_local = start_local + timedelta(days=1)
    start_utc = start_local.astimezone(timezone.utc).replace(microsecond=0).isoformat()
    end_utc = end_local.astimezone(timezone.utc).replace(microsecond=0).isoformat()
    return start_utc, end_utc


def _pending_inbox_count(connection: Any, user_id: str) -> int:
    row = connection.execute(
        """
        SELECT COUNT(*) AS count
        FROM match_requests mr
        JOIN match_posts mp ON mp.id = mr.post_id
        WHERE mp.user_id = ?
          AND mr.status = 'pending'
        """,
        (user_id,),
    ).fetchone()
    return int(row["count"] if row else 0)


def _store_match_post_image(media_file: UploadFile) -> str:
    if not media_file.content_type or not media_file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Match post image must be an image file.")

    suffix = Path(media_file.filename or "").suffix.lower() or ".bin"
    MATCH_POST_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    stored_name = f"match_post_{uuid.uuid4().hex}{suffix}"
    stored_path = MATCH_POST_UPLOADS_DIR / stored_name

    with stored_path.open("wb") as output_file:
        while True:
            chunk = media_file.file.read(1024 * 1024)
            if not chunk:
                break
            output_file.write(chunk)

    return f"/uploads/match-posts/{stored_name}"


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


@router.get("/match/posts")
def list_match_posts(
    limit: int = Query(default=20, ge=1, le=100),
    include_mine: bool = Query(default=False),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    connection = get_connection()
    try:
        own_filter = "" if include_mine else "AND mp.user_id <> ?"
        params: list[Any] = [current_user["id"]]
        if not include_mine:
            params.append(current_user["id"])
        params.append(current_user["id"])
        params.extend([current_user["id"], current_user["id"], limit])
        rows = connection.execute(
            f"""
            SELECT mp.id,
                   mp.user_id,
                   mp.role_preference,
                   mp.intro,
                   mp.image_url,
                   mp.status,
                   mp.created_at,
                   mp.expires_at,
                   u.display_name,
                   u.gender,
                   u.seeking_gender,
                   u.sexual_orientation,
                   u.identity_labels_json,
                   EXISTS (
                       SELECT 1
                       FROM match_requests r
                       WHERE r.post_id = mp.id
                         AND r.requester_id = ?
                         AND r.status = 'pending'
                   ) AS has_pending_request
            FROM match_posts mp
            JOIN users u ON u.id = mp.user_id
            WHERE mp.status = 'active'
              {own_filter}
              AND NOT EXISTS (
                  SELECT 1
                  FROM match_requests r2
                  WHERE r2.post_id = mp.id
                    AND r2.requester_id = ?
                    AND r2.status = 'pending'
              )
              AND NOT EXISTS (
                  SELECT 1 FROM match_blocks b
                  WHERE (b.blocker_user_id = mp.user_id AND b.blocked_user_id = ?)
                     OR (b.blocker_user_id = ? AND b.blocked_user_id = mp.user_id)
              )
            ORDER BY mp.created_at DESC
            LIMIT ?
            """,
            tuple(params),
        ).fetchall()
        posts: list[dict[str, Any]] = []
        for row in rows:
            post = dict(row)
            post["identity_labels"] = decode_identity_labels(post.get("identity_labels_json"))
            post.pop("identity_labels_json", None)
            posts.append(post)
        return {"posts": posts}
    finally:
        connection.close()


@router.post("/match/posts/upload-image", status_code=status.HTTP_201_CREATED)
def upload_match_post_image(
    image_file: UploadFile = File(...),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    _ = current_user
    return {"image_url": _store_match_post_image(image_file)}


@router.post("/match/posts")
def create_match_post(
    payload: CreateMatchPostRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    with transactional_connection() as connection:
        if get_current_relationship_for_user(connection, current_user["id"]):
            _raise_api_error(409, "MATCH_ALREADY_PAIRED", "Current user already has an active or pending relationship.")

        active = connection.execute(
            "SELECT id FROM match_posts WHERE user_id = ? AND status = 'active'",
            (current_user["id"],),
        ).fetchone()
        if active:
            _raise_api_error(409, "MATCH_POST_ALREADY_ACTIVE", "You already have an active match post.")
        if payload.image_url and not payload.image_url.startswith("/uploads/match-posts/"):
            raise HTTPException(status_code=400, detail="Invalid match post image.")

        post_id = str(uuid.uuid4())
        now = utc_now()
        connection.execute(
            """
            INSERT INTO match_posts (id, user_id, role_preference, intro, image_url, status, created_at, expires_at)
            VALUES (?, ?, ?, ?, ?, 'active', ?, NULL)
            """,
            (
                post_id,
                current_user["id"],
                current_user["role_preference"],
                payload.intro.strip(),
                payload.image_url.strip() if payload.image_url else None,
                now,
            ),
        )
        row = connection.execute(
            """
            SELECT id, user_id, role_preference, intro, image_url, status, created_at, expires_at
            FROM match_posts
            WHERE id = ?
            """,
            (post_id,),
        ).fetchone()
        return {"post": row_to_dict(row)}


@router.put("/match/posts/{post_id}")
def update_match_post(
    post_id: str,
    payload: UpdateMatchPostRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    with transactional_connection() as connection:
        row = connection.execute("SELECT * FROM match_posts WHERE id = ?", (post_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Match post not found.")
        post = row_to_dict(row)
        if post["user_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Cannot edit another user's post.")
        if post["status"] != "active":
            _raise_api_error(409, "MATCH_POST_NOT_ACTIVE", "Can only edit an active post.")
        if payload.image_url and not payload.image_url.startswith("/uploads/match-posts/"):
            raise HTTPException(status_code=400, detail="Invalid match post image.")
        connection.execute(
            "UPDATE match_posts SET intro = ?, image_url = ? WHERE id = ?",
            (payload.intro.strip(), payload.image_url.strip() if payload.image_url else None, post_id),
        )
        updated = connection.execute("SELECT * FROM match_posts WHERE id = ?", (post_id,)).fetchone()
        return {"post": row_to_dict(updated)}


@router.post("/match/posts/{post_id}/close")
def close_match_post(post_id: str, current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    with transactional_connection() as connection:
        row = connection.execute("SELECT * FROM match_posts WHERE id = ?", (post_id,)).fetchone()
        post = row_to_dict(row)
        if not post:
            raise HTTPException(status_code=404, detail="Match post not found.")
        if post["user_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Cannot close another user's post.")
        if post["status"] == "active":
            connection.execute("UPDATE match_posts SET status = 'closed' WHERE id = ?", (post_id,))
            post["status"] = "closed"
        return {"post": post}


@router.post("/match/posts/{post_id}/requests")
def create_match_request(
    post_id: str,
    payload: CreateMatchRequestRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
    user_timezone: str | None = Header(default=None, alias="X-User-Timezone"),
) -> dict[str, Any]:
    with transactional_connection() as connection:
        post_row = connection.execute("SELECT * FROM match_posts WHERE id = ?", (post_id,)).fetchone()
        post = row_to_dict(post_row)
        if not post:
            raise HTTPException(status_code=404, detail="Match post not found.")
        if post["status"] != "active":
            _raise_api_error(409, "MATCH_POST_NOT_ACTIVE", "Match post is not active.")
        if post["user_id"] == current_user["id"]:
            raise HTTPException(status_code=400, detail="Cannot send a match request to yourself.")

        target_user_row = connection.execute(
            "SELECT id, role_preference FROM users WHERE id = ?",
            (post["user_id"],),
        ).fetchone()
        target_user = row_to_dict(target_user_row)
        if not target_user:
            raise HTTPException(status_code=404, detail="Match post user not found.")

        if current_user["role_preference"] == post["role_preference"]:
            _raise_api_error(400, "MATCH_SAME_ROLE_FORBIDDEN", "Accounts with the same role cannot be matched.")

        blocked = connection.execute(
            """
            SELECT 1
            FROM match_blocks
            WHERE (blocker_user_id = ? AND blocked_user_id = ?)
               OR (blocker_user_id = ? AND blocked_user_id = ?)
            LIMIT 1
            """,
            (post["user_id"], current_user["id"], current_user["id"], post["user_id"]),
        ).fetchone()
        if blocked:
            _raise_api_error(403, "MATCH_BLOCKED_BY_TARGET", "You are blocked by this user.")

        if get_current_relationship_for_user(connection, current_user["id"]):
            _raise_api_error(409, "MATCH_ALREADY_PAIRED", "Current user already has an active or pending relationship.")
        if get_current_relationship_for_user(connection, target_user["id"]):
            _raise_api_error(409, "MATCH_ALREADY_PAIRED", "Target user already has an active or pending relationship.")

        start_utc, end_utc = _daily_window_utc(user_timezone)
        limit_row = connection.execute(
            """
            SELECT COUNT(*) AS count
            FROM match_requests
            WHERE requester_id = ?
              AND created_at >= ?
              AND created_at < ?
            """,
            (current_user["id"], start_utc, end_utc),
        ).fetchone()
        sent_count = int(limit_row["count"] if limit_row else 0)
        if sent_count >= DAILY_INVITE_LIMIT:
            _raise_api_error(429, "MATCH_DAILY_LIMIT_REACHED", "Daily invite limit reached.")

        duplicate = connection.execute(
            """
            SELECT 1
            FROM match_requests
            WHERE post_id = ?
              AND requester_id = ?
              AND status = 'pending'
            """,
            (post_id, current_user["id"]),
        ).fetchone()
        if duplicate:
            raise HTTPException(status_code=409, detail="You already have a pending request for this post.")

        request_id = str(uuid.uuid4())
        created_at = utc_now()
        connection.execute(
            """
            INSERT INTO match_requests (
                id, post_id, requester_id, status, message, reject_reason_code, created_at, handled_at
            ) VALUES (?, ?, ?, 'pending', ?, NULL, ?, NULL)
            """,
            (request_id, post_id, current_user["id"], payload.message.strip() if payload.message else None, created_at),
        )
        request_row = connection.execute("SELECT * FROM match_requests WHERE id = ?", (request_id,)).fetchone()
        pending_count = _pending_inbox_count(connection, post["user_id"])

    notification_manager.run_background(
        notification_manager.send_to_user(
            post["user_id"],
            {
                "type": "match.request.new",
                "request_id": request_id,
                "post_id": post_id,
                "pending_count": pending_count,
            },
        )
    )
    return {"request": row_to_dict(request_row), "daily_sent": sent_count + 1, "daily_limit": DAILY_INVITE_LIMIT}


@router.get("/match/requests/inbox")
def list_match_request_inbox(current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    connection = get_connection()
    try:
        rows = connection.execute(
            """
            SELECT mr.id,
                   mr.post_id,
                   mr.requester_id,
                   mr.status,
                   mr.message,
                   mr.reject_reason_code,
                   mr.created_at,
                   mr.handled_at,
                   ru.display_name AS requester_display_name,
                   ru.role_preference AS requester_role_preference,
                   mp.user_id AS target_user_id
            FROM match_requests mr
            JOIN match_posts mp ON mp.id = mr.post_id
            JOIN users ru ON ru.id = mr.requester_id
            WHERE mp.user_id = ?
            ORDER BY CASE mr.status WHEN 'pending' THEN 0 ELSE 1 END, mr.created_at DESC
            """,
            (current_user["id"],),
        ).fetchall()
        pending_count = _pending_inbox_count(connection, current_user["id"])
        return {"requests": [dict(row) for row in rows], "pending_count": pending_count}
    finally:
        connection.close()


@router.get("/match/requests/sent")
def list_sent_match_requests(current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    connection = get_connection()
    try:
        rows = connection.execute(
            """
            SELECT mr.id,
                   mr.post_id,
                   mr.requester_id,
                   mr.status,
                   mr.message,
                   mr.reject_reason_code,
                   mr.created_at,
                   mr.handled_at,
                   tu.id AS target_user_id,
                   tu.display_name AS target_display_name,
                   tu.role_preference AS target_role_preference
            FROM match_requests mr
            JOIN match_posts mp ON mp.id = mr.post_id
            JOIN users tu ON tu.id = mp.user_id
            WHERE mr.requester_id = ?
            ORDER BY mr.created_at DESC
            """,
            (current_user["id"],),
        ).fetchall()
        return {"requests": [dict(row) for row in rows]}
    finally:
        connection.close()


@router.post("/match/requests/{request_id}/accept")
def accept_match_request(
    request_id: str,
    payload: HandleMatchRequestRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    del payload
    with transactional_connection() as connection:
        row = connection.execute(
            """
            SELECT mr.*,
                   mp.user_id AS target_user_id,
                   mp.status AS post_status
            FROM match_requests mr
            JOIN match_posts mp ON mp.id = mr.post_id
            WHERE mr.id = ?
            """,
            (request_id,),
        ).fetchone()
        match_request = row_to_dict(row)
        if not match_request:
            raise HTTPException(status_code=404, detail="Match request not found.")
        if match_request["target_user_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Only target user can handle this request.")
        if match_request["status"] != "pending":
            raise HTTPException(status_code=409, detail="Match request is not pending.")
        if match_request["post_status"] != "active":
            _raise_api_error(409, "MATCH_ALREADY_PAIRED", "Match post is not active.")

        requester_row = connection.execute(
            "SELECT id, role_preference FROM users WHERE id = ?",
            (match_request["requester_id"],),
        ).fetchone()
        requester = row_to_dict(requester_row)
        if not requester:
            raise HTTPException(status_code=404, detail="Requester not found.")
        if requester["role_preference"] == current_user["role_preference"]:
            _raise_api_error(400, "MATCH_SAME_ROLE_FORBIDDEN", "Accounts with the same role cannot be matched.")

        if get_current_relationship_for_user(connection, current_user["id"]):
            _raise_api_error(409, "MATCH_ALREADY_PAIRED", "Current user already has an active or pending relationship.")
        if get_current_relationship_for_user(connection, requester["id"]):
            _raise_api_error(409, "MATCH_ALREADY_PAIRED", "Requester already has an active or pending relationship.")

        owner_id = current_user["id"] if current_user["role_preference"] == "owner" else requester["id"]
        puppy_id = current_user["id"] if current_user["role_preference"] == "puppy" else requester["id"]
        relationship_id = str(uuid.uuid4())
        now = utc_now()
        connection.execute(
            """
            INSERT INTO relationships (id, owner_id, puppy_id, status, intimacy_score, created_at)
            VALUES (?, ?, ?, 'active', 0, ?)
            """,
            (relationship_id, owner_id, puppy_id, now),
        )

        connection.execute(
            """
            UPDATE match_requests
            SET status = 'accepted', handled_at = ?, reject_reason_code = NULL
            WHERE id = ?
            """,
            (now, request_id),
        )

        connection.execute(
            """
            UPDATE match_requests
            SET status = 'rejected',
                handled_at = ?,
                reject_reason_code = 'MATCH_ALREADY_PAIRED'
            WHERE status = 'pending'
              AND id <> ?
              AND (
                  requester_id IN (?, ?)
                  OR post_id IN (SELECT id FROM match_posts WHERE user_id IN (?, ?))
              )
            """,
            (now, request_id, requester["id"], current_user["id"], requester["id"], current_user["id"]),
        )
        connection.execute(
            "UPDATE match_posts SET status = 'matched' WHERE status = 'active' AND user_id IN (?, ?)",
            (requester["id"], current_user["id"]),
        )

        accepted_row = connection.execute("SELECT * FROM match_requests WHERE id = ?", (request_id,)).fetchone()
        rel_row = connection.execute("SELECT * FROM relationships WHERE id = ?", (relationship_id,)).fetchone()
        target_pending_count = _pending_inbox_count(connection, current_user["id"])

    notification_manager.run_background(
        notification_manager.send_to_user(
            requester["id"],
            {
                "type": "match.request.updated",
                "request_id": request_id,
                "status": "accepted",
            },
        )
    )
    notification_manager.run_background(
        notification_manager.send_to_user(
            current_user["id"],
            {
                "type": "match.request.updated",
                "request_id": request_id,
                "status": "accepted",
                "pending_count": target_pending_count,
            },
        )
    )
    return {"request": row_to_dict(accepted_row), "relationship": row_to_dict(rel_row)}


@router.post("/match/requests/{request_id}/reject")
def reject_match_request(
    request_id: str,
    payload: HandleMatchRequestRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    with transactional_connection() as connection:
        row = connection.execute(
            """
            SELECT mr.*, mp.user_id AS target_user_id
            FROM match_requests mr
            JOIN match_posts mp ON mp.id = mr.post_id
            WHERE mr.id = ?
            """,
            (request_id,),
        ).fetchone()
        match_request = row_to_dict(row)
        if not match_request:
            raise HTTPException(status_code=404, detail="Match request not found.")
        if match_request["target_user_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Only target user can handle this request.")
        if match_request["status"] != "pending":
            raise HTTPException(status_code=409, detail="Match request is not pending.")
        now = utc_now()
        reason_code = "MATCH_REQUEST_REJECTED"
        if payload.reason and payload.reason.strip():
            reason_code = payload.reason.strip()[:64]
        connection.execute(
            """
            UPDATE match_requests
            SET status = 'rejected', handled_at = ?, reject_reason_code = ?
            WHERE id = ?
            """,
            (now, reason_code, request_id),
        )
        updated = connection.execute("SELECT * FROM match_requests WHERE id = ?", (request_id,)).fetchone()
        pending_count = _pending_inbox_count(connection, current_user["id"])

    notification_manager.run_background(
        notification_manager.send_to_user(
            match_request["requester_id"],
            {
                "type": "match.request.updated",
                "request_id": request_id,
                "status": "rejected",
                "reject_reason_code": reason_code,
            },
        )
    )
    notification_manager.run_background(
        notification_manager.send_to_user(
            current_user["id"],
            {
                "type": "match.request.updated",
                "request_id": request_id,
                "status": "rejected",
                "pending_count": pending_count,
            },
        )
    )
    return {"request": row_to_dict(updated)}


@router.post("/match/blocks")
def block_user(payload: BlockUserRequest, current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    if payload.target_user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot block yourself.")
    with transactional_connection() as connection:
        target = connection.execute("SELECT id FROM users WHERE id = ?", (payload.target_user_id,)).fetchone()
        if not target:
            raise HTTPException(status_code=404, detail="Target user not found.")

        existing = connection.execute(
            """
            SELECT id
            FROM match_blocks
            WHERE blocker_user_id = ? AND blocked_user_id = ?
            """,
            (current_user["id"], payload.target_user_id),
        ).fetchone()
        if existing:
            return {"blocked": True}

        block_id = str(uuid.uuid4())
        connection.execute(
            """
            INSERT INTO match_blocks (id, blocker_user_id, blocked_user_id, reason, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (block_id, current_user["id"], payload.target_user_id, payload.reason, utc_now()),
        )
        return {"blocked": True}


@router.post("/match/reports")
def report_match(payload: ReportMatchRequest, current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    if payload.target_user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot report yourself.")
    with transactional_connection() as connection:
        report_id = str(uuid.uuid4())
        connection.execute(
            """
            INSERT INTO match_reports (
                id, reporter_user_id, target_user_id, request_id, reason, created_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            (report_id, current_user["id"], payload.target_user_id, payload.request_id, payload.reason.strip(), utc_now()),
        )
        return {"reported": True}


@router.websocket("/ws/notifications")
async def notifications_websocket(websocket: WebSocket) -> None:
    token = websocket.query_params.get("token")
    user = _resolve_ws_user(token)
    if not user:
        await websocket.accept()
        await websocket.send_json({"type": "error", "detail": "Invalid token."})
        await websocket.close(code=1008)
        return

    await notification_manager.connect(user["id"], websocket)
    connection = get_connection()
    try:
        pending_count = _pending_inbox_count(connection, user["id"])
    finally:
        connection.close()
    await notification_manager.send_to_user(
        user["id"],
        {
            "type": "match.request.pending_count",
            "pending_count": pending_count,
        },
    )

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await notification_manager.disconnect(user["id"], websocket)
    except Exception:
        await notification_manager.disconnect(user["id"], websocket)

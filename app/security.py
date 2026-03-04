from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets


SECRET_KEY = os.getenv("PUPPY_SECRET_KEY", "dev-secret-key-change-me")


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.sha256(f"{salt}:{password}".encode("utf-8")).hexdigest()
    return f"{salt}${digest}"


def verify_password(password: str, stored_hash: str) -> bool:
    salt, expected = stored_hash.split("$", 1)
    actual = hashlib.sha256(f"{salt}:{password}".encode("utf-8")).hexdigest()
    return hmac.compare_digest(actual, expected)


def generate_token(user_id: str) -> str:
    signature = hmac.new(SECRET_KEY.encode("utf-8"), user_id.encode("utf-8"), hashlib.sha256).digest()
    return f"{user_id}.{base64.urlsafe_b64encode(signature).decode('ascii')}"


def verify_token(token: str) -> str | None:
    if "." not in token:
        return None
    user_id, _ = token.split(".", 1)
    expected = generate_token(user_id)
    if hmac.compare_digest(token, expected):
        return user_id
    return None


def generate_invite_code() -> str:
    return secrets.token_urlsafe(6).replace("-", "").replace("_", "")[:8].upper()

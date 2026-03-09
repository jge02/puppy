from __future__ import annotations

import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


RolePreference = Literal["owner", "puppy"]
TaskSubmissionType = Literal["note", "image", "video"]


EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=8)
    display_name: str = Field(min_length=1, max_length=30)
    role_preference: RolePreference

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        email = value.lower()
        if not EMAIL_PATTERN.match(email):
            raise ValueError("Invalid email format.")
        return email


class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        email = value.lower()
        if not EMAIL_PATTERN.match(email):
            raise ValueError("Invalid email format.")
        return email


class BindByInviteRequest(BaseModel):
    invite_code: str = Field(min_length=4, max_length=32)


class CreateTaskRequest(BaseModel):
    relationship_id: str
    task_request_id: str | None = None
    title: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=1, max_length=2000)
    reward_coins: int | None = Field(default=None, ge=0, le=100000)
    deadline: datetime | None = None
    expected_submission_type: TaskSubmissionType = "note"


class CreateTaskRequestRequest(BaseModel):
    relationship_id: str
    title: str = Field(min_length=1, max_length=100)
    note: str | None = Field(default=None, max_length=2000)


class RejectTaskRequestRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=2000)


class SubmitTaskRequest(BaseModel):
    note: str | None = Field(default=None, max_length=2000)
    media_url: str | None = Field(default=None, max_length=2000)


class RejectTaskRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=2000)


class ChatReadRequest(BaseModel):
    relationship_id: str
    message_id: str

from __future__ import annotations

import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


RolePreference = Literal["owner", "puppy"]
TaskSubmissionType = Literal["note", "image", "video"]
Gender = Literal["male", "female", "trans", "non_binary", "private"]
SeekingGender = Literal["male", "female", "trans", "non_binary", "any"]
SexualOrientation = Literal["hetero", "homo", "bi", "pan", "asexual", "questioning", "unspecified"]
IdentityLabel = Literal["lesbian", "gay", "femboy", "ts", "cd", "4i"]


EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=8)
    display_name: str = Field(min_length=1, max_length=30)
    role_preference: RolePreference
    gender: Gender = "private"
    seeking_gender: SeekingGender = "any"
    sexual_orientation: SexualOrientation = "unspecified"
    identity_labels: list[IdentityLabel] = Field(default_factory=list)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        email = value.lower()
        if not EMAIL_PATTERN.match(email):
            raise ValueError("Invalid email format.")
        return email

    @field_validator("identity_labels")
    @classmethod
    def dedupe_identity_labels(cls, labels: list[IdentityLabel]) -> list[IdentityLabel]:
        deduped = list(dict.fromkeys(labels))
        return deduped


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


class UpdateProfileRequest(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=30)
    gender: Gender | None = None
    seeking_gender: SeekingGender | None = None
    sexual_orientation: SexualOrientation | None = None
    identity_labels: list[IdentityLabel] | None = None

    @field_validator("identity_labels")
    @classmethod
    def dedupe_identity_labels(cls, labels: list[IdentityLabel] | None) -> list[IdentityLabel] | None:
        if labels is None:
            return None
        deduped = list(dict.fromkeys(labels))
        return deduped


class BindByInviteRequest(BaseModel):
    invite_code: str = Field(min_length=4, max_length=32)


class CreateMatchPostRequest(BaseModel):
    intro: str = Field(min_length=1, max_length=300)
    image_url: str | None = Field(default=None, max_length=2000)


class UpdateMatchPostRequest(BaseModel):
    intro: str = Field(min_length=1, max_length=300)
    image_url: str | None = Field(default=None, max_length=2000)


class CreateMatchRequestRequest(BaseModel):
    message: str | None = Field(default=None, max_length=300)


class HandleMatchRequestRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=300)


class BlockUserRequest(BaseModel):
    target_user_id: str
    reason: str | None = Field(default=None, max_length=300)


class ReportMatchRequest(BaseModel):
    target_user_id: str
    request_id: str | None = None
    reason: str = Field(min_length=1, max_length=300)


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

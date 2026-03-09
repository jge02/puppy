import type { MessageKey } from "./messages";

const apiErrorMap: Record<string, MessageKey> = {
  "Email already registered.": "common.error_email_registered",
  "Invalid email or password.": "common.error_invalid_credentials",
  "Invite code not found.": "common.error_invite_code_not_found",
  "Cannot bind using your own invite code.": "common.error_invite_code_self",
  "Owner-only accounts cannot bind as puppy.": "common.error_occurred",
  "Target account cannot act as owner.": "common.error_occurred",
  "Current user already has an active or pending relationship.": "common.error_occurred",
  "Invite code owner already has an active or pending relationship.": "common.error_occurred",
  "No active or pending relationship.": "common.error_occurred",
  "Relationship not found.": "common.error_occurred",
  "Ended relationship cannot be changed.": "common.error_occurred",
  "Only active relationships can be paused.": "common.error_occurred",
  "Relationship cannot be ended from current status.": "common.error_occurred",
  "Task not found.": "common.error_occurred",
  "Only owner can create tasks.": "dashboard.only_owner_can_create",
  "Tasks can only be created in active relationships.": "common.error_occurred",
  "Deadline must be in the future.": "common.error_occurred",
  "Only assigned puppy can submit the task.": "common.error_occurred",
  "Task relationship is not active.": "common.error_occurred",
  "Task has expired.": "common.error_occurred",
  "Only open tasks can be submitted.": "common.error_occurred",
  "Task requires an image submission.": "common.error_occurred",
  "Task requires a video submission.": "common.error_occurred",
  "Task requires an image file.": "common.error_occurred",
  "Task requires a video file.": "common.error_occurred",
  "This task does not accept file uploads.": "common.error_occurred",
  "Task already has a submission.": "common.error_occurred",
  "Only owner can approve the task.": "common.error_occurred",
  "Only submitted tasks can be approved.": "common.error_occurred",
  "Task approval conflict.": "common.error_occurred",
  "Only owner can reject the task.": "common.error_occurred",
  "Only submitted tasks can be rejected.": "common.error_occurred",
  "Only puppy can request tasks.": "common.error_occurred",
  "Task requests require an active relationship.": "common.error_occurred",
  "Task request not found.": "common.error_occurred",
  "Only owner can reject task requests.": "common.error_occurred",
  "Task request is not pending.": "common.error_occurred",
  "Task request belongs to another relationship.": "common.error_occurred",
  "Task request relationship is not active.": "common.error_occurred",
  "Task request update conflict.": "common.error_occurred",
};

export function translateApiError(
  detail: string,
  t: (key: MessageKey) => string
): string {
  const key = apiErrorMap[detail];
  return key ? t(key) : t("common.error_occurred");
}

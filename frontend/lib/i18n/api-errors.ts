import type { MessageKey } from "./messages";

const apiErrorMap: Record<string, MessageKey> = {
  "Email already registered.": "common.request_failed",
  "Invalid email or password.": "common.request_failed",
  "Invite code not found.": "common.request_failed",
  "Cannot bind using your own invite code.": "common.request_failed",
  "Owner-only accounts cannot bind as puppy.": "common.request_failed",
  "Target account cannot act as owner.": "common.request_failed",
  "Current user already has an active or pending relationship.": "common.request_failed",
  "Invite code owner already has an active or pending relationship.": "common.request_failed",
  "No active or pending relationship.": "common.request_failed",
  "Relationship not found.": "common.request_failed",
  "Ended relationship cannot be changed.": "common.request_failed",
  "Only active relationships can be paused.": "common.request_failed",
  "Relationship cannot be ended from current status.": "common.request_failed",
  "Task not found.": "common.request_failed",
  "Only owner can create tasks.": "dashboard.only_owner_can_create",
  "Tasks can only be created in active relationships.": "common.request_failed",
  "Deadline must be in the future.": "common.request_failed",
  "Only assigned puppy can submit the task.": "common.request_failed",
  "Task relationship is not active.": "common.request_failed",
  "Task has expired.": "common.request_failed",
  "Only open tasks can be submitted.": "common.request_failed",
  "Task requires an image submission.": "common.request_failed",
  "Task requires a video submission.": "common.request_failed",
  "Task requires an image file.": "common.request_failed",
  "Task requires a video file.": "common.request_failed",
  "This task does not accept file uploads.": "common.request_failed",
  "Task already has a submission.": "common.request_failed",
  "Only owner can approve the task.": "common.request_failed",
  "Only submitted tasks can be approved.": "common.request_failed",
  "Task approval conflict.": "common.request_failed",
  "Only owner can reject the task.": "common.request_failed",
  "Only submitted tasks can be rejected.": "common.request_failed",
  "Only puppy can request tasks.": "common.request_failed",
  "Task requests require an active relationship.": "common.request_failed",
  "Task request not found.": "common.request_failed",
  "Only owner can reject task requests.": "common.request_failed",
  "Task request is not pending.": "common.request_failed",
  "Task request belongs to another relationship.": "common.request_failed",
  "Task request relationship is not active.": "common.request_failed",
  "Task request update conflict.": "common.request_failed",
};

export function translateApiError(
  detail: string,
  t: (key: MessageKey) => string
): string {
  const key = apiErrorMap[detail];
  return key ? t(key) : detail;
}

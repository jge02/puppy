"use client";

import {
  AppstoreOutlined,
  ClockCircleOutlined,
  LinkOutlined,
  LogoutOutlined,
  MessageOutlined,
  OrderedListOutlined,
  PlusOutlined,
  ReloadOutlined,
  SendOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Badge,
  Button,
  Calendar,
  Card,
  Empty,
  Form,
  Grid,
  Input,
  Layout,
  List,
  Menu,
  Modal,
  Select,
  Space,
  Statistic,
  Tag,
  Typography,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { translateApiError } from "../../lib/i18n/api-errors";
import type { MessageKey } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/useI18n";
import { ErrorState } from "../../components/ErrorState";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { LoadingState } from "../../components/LoadingState";
import "./dashboard.css";

const { Content, Sider } = Layout;
const { Text, Title } = Typography;
const { TextArea } = Input;

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

function resolveWsBaseUrl(apiBaseUrl: string) {
  if (apiBaseUrl.startsWith("ws://") || apiBaseUrl.startsWith("wss://")) {
    return apiBaseUrl;
  }
  if (apiBaseUrl.startsWith("http://")) {
    return `ws://${apiBaseUrl.slice("http://".length)}`;
  }
  if (apiBaseUrl.startsWith("https://")) {
    return `wss://${apiBaseUrl.slice("https://".length)}`;
  }
  if (typeof window !== "undefined") {
    const normalizedBase = apiBaseUrl.startsWith("/") ? apiBaseUrl : `/${apiBaseUrl}`;
    const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
    return `${wsProtocol}://${window.location.host}${normalizedBase}`;
  }
  return apiBaseUrl;
}

const WS_BASE_URL = resolveWsBaseUrl(API_BASE_URL);
const TOKEN_KEY = "puppy_token";
const SKIP_BIND_KEY = "puppy_skip_bind";
function resolveTaskSubmissionMaxFileSizeMb() {
  const rawValue = process.env.NEXT_PUBLIC_TASK_SUBMISSION_MAX_FILE_SIZE_MB;
  if (!rawValue || !rawValue.trim()) {
    return null;
  }
  const parsedValue = Number(rawValue);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return null;
  }
  return parsedValue;
}

const TASK_SUBMISSION_MAX_FILE_SIZE_MB = resolveTaskSubmissionMaxFileSizeMb();
const TASK_SUBMISSION_MAX_FILE_SIZE_BYTES =
  TASK_SUBMISSION_MAX_FILE_SIZE_MB === null
    ? null
    : TASK_SUBMISSION_MAX_FILE_SIZE_MB * 1024 * 1024;

type User = {
  id: string;
  email: string;
  display_name: string;
  role_preference: "owner" | "puppy";
  invite_code: string;
  gender: "male" | "female" | "trans" | "non_binary" | "private";
  seeking_gender: "male" | "female" | "trans" | "non_binary" | "any";
  sexual_orientation: "hetero" | "homo" | "bi" | "pan" | "asexual" | "questioning" | "unspecified";
  identity_labels: ("lesbian" | "gay" | "femboy" | "ts" | "cd" | "4i")[];
};

type Wallet = {
  balance: number;
};

type MeResponse = {
  user: User;
  wallet: Wallet;
  current_relationship?: {
    id: string;
  } | null;
};

type RelationshipSummary = {
  relationship: {
    id: string;
    status: string;
    intimacy_score: number;
  };
  my_role_in_relationship: "owner" | "puppy";
  counterpart: {
    display_name: string;
    email: string;
  };
};

type Task = {
  id: string;
  title: string;
  description: string;
  reward_coins: number;
  deadline: string | null;
  expected_submission_type: "note" | "image" | "video";
  status: "open" | "submitted" | "approved" | "rejected" | "expired";
  submission_note?: string | null;
  submission_media_type?: "image" | "video" | null;
  submission_media_url?: string | null;
  submission_submitted_at?: string | null;
};

type TaskRequest = {
  id: string;
  relationship_id: string;
  requester_id: string;
  title: string;
  note: string | null;
  status: "pending" | "fulfilled" | "rejected";
  linked_task_id: string | null;
  created_at: string;
  handled_at: string | null;
  handled_by: string | null;
};

type TaskFormState = {
  title: string;
  description: string;
  deadline: string;
  expected_submission_type: "note" | "image" | "video";
};

type TaskSubmissionFormState = {
  taskId: string | null;
  expected_submission_type: "note" | "image" | "video";
  note: string;
  media_file: File | null;
};

type TaskRequestFormState = {
  title: string;
  note: string;
};

type TaskSubmissionPreviewState = Task | null;

type ChatMessageKind = "text" | "system_task";

type ChatMessage = {
  id: string;
  relationship_id: string;
  sender_id: string | null;
  kind: ChatMessageKind;
  content: {
    text?: string;
    action?: string;
    task_id?: string | null;
    title?: string;
    actor_id?: string;
    timestamp?: string;
    request_id?: string;
  };
  created_at: string;
  client_msg_id?: string | null;
  pending?: boolean;
  failed?: boolean;
};

type UnreadState = {
  relationship_id: string;
  last_read_message_id: string | null;
  last_read_at: string | null;
  unread_count: number;
};

type DashboardSection = "overview" | "tasks" | "requests" | "chat" | "profile";
type IdentityLabel = "lesbian" | "gay" | "femboy" | "ts" | "cd" | "4i";
type ProfileFormState = {
  display_name: string;
  gender: User["gender"];
  seeking_gender: User["seeking_gender"];
  sexual_orientation: User["sexual_orientation"];
  identity_labels: IdentityLabel[];
};

const initialTask: TaskFormState = {
  title: "",
  description: "",
  deadline: "",
  expected_submission_type: "note",
};

const initialTaskSubmission: TaskSubmissionFormState = {
  taskId: null,
  expected_submission_type: "note",
  note: "",
  media_file: null,
};

const initialTaskRequest: TaskRequestFormState = {
  title: "",
  note: "",
};

const taskRequestPresetKeys = [
  "dashboard.task_request_preset.training",
  "dashboard.task_request_preset.discipline",
  "dashboard.task_request_preset.structured",
] as const;

async function apiRequest(
  path: string,
  {
    method = "GET",
    body,
    token,
  }: { method?: string; body?: unknown; token?: string } = {}
) {
  const headers: Record<string, string> = {};
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  if (body !== undefined && !isFormData) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
    cache: "no-store",
  });

  const data = (await response.json().catch(() => ({}))) as { detail?: string };
  if (!response.ok) {
    if (typeof data.detail === "string" && data.detail.trim()) {
      throw new Error(data.detail);
    }
    if (response.status === 413) {
      throw new Error("Request Entity Too Large");
    }
    throw new Error(response.statusText || "Request failed");
  }
  return data;
}

function toPayloadDate(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function getDefaultDeadlineValue() {
  return dayjs().add(1, "hour").minute(0).second(0).millisecond(0);
}

function parseDeadlineValue(value: string) {
  if (!value) {
    return null;
  }
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed : null;
}

function formatDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getTaskTagColor(status: Task["status"]) {
  if (status === "open") return "gold";
  if (status === "submitted") return "blue";
  if (status === "approved") return "green";
  if (status === "rejected") return "red";
  return "default";
}

function getTaskRequestTagColor(status: TaskRequest["status"]) {
  if (status === "pending") return "gold";
  if (status === "fulfilled") return "green";
  if (status === "rejected") return "red";
  return "default";
}

function normalizeUser(user: Partial<User>): User {
  return {
    id: user.id || "",
    email: user.email || "",
    display_name: user.display_name || "",
    role_preference: user.role_preference === "puppy" ? "puppy" : "owner",
    invite_code: user.invite_code || "",
    gender: user.gender || "private",
    seeking_gender: user.seeking_gender || "any",
    sexual_orientation: user.sexual_orientation || "unspecified",
    identity_labels: Array.isArray(user.identity_labels) ? user.identity_labels : [],
  };
}

function toggleIdentityLabel(current: IdentityLabel[], label: IdentityLabel) {
  if (current.includes(label)) {
    return current.filter((item) => item !== label);
  }
  return [...current, label];
}

function getRelationshipTagColor(status: string) {
  if (status === "active") return "green";
  if (status === "pending") return "gold";
  if (status === "ended") return "red";
  return "default";
}

function getRoleMarker(role: "owner" | "puppy") {
  return role === "owner" ? "👑" : "🦴";
}

function needsMediaSubmission(type: Task["expected_submission_type"]) {
  return type === "image" || type === "video";
}

function getSubmissionPickerLabel(
  type: TaskSubmissionFormState["expected_submission_type"],
  t: (key: MessageKey) => string
) {
  if (type === "image") {
    return t("dashboard.task_submission_pick_image");
  }
  return t("dashboard.task_submission_pick_video");
}

function getSubmissionHelperText(
  type: TaskSubmissionFormState["expected_submission_type"],
  t: (key: MessageKey) => string
) {
  if (type === "image") {
    return t("dashboard.task_submission_image_hint");
  }
  return t("dashboard.task_submission_video_hint");
}

function getSubmissionFileSizeHint(maxSizeMb: number | null) {
  if (maxSizeMb === null) {
    return null;
  }
  return `Max file size: ${maxSizeMb}MB.`;
}

function getSubmissionFileTooLargeMessage(maxSizeMb: number | null) {
  if (maxSizeMb === null) {
    return "File is too large. Please upload a smaller file.";
  }
  return `File is too large. Please upload a file smaller than ${maxSizeMb}MB.`;
}

function getSubmissionPayloadTooLargeMessage() {
  return "Upload failed because the file is too large for the server limit. Please compress the file and try again.";
}

function toAssetUrl(url: string) {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `${API_BASE_URL}${url}`;
}

function createClientMessageId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isZhLocale(locale: string) {
  return locale.startsWith("zh");
}

function getChatCopy(locale: string) {
  if (isZhLocale(locale)) {
    return {
      title: "聊天",
      sectionHint: "实时对话与任务动态。",
      online: "在线",
      connecting: "连接中...",
      offline: "离线",
      sending: "发送中...",
      retry: "重试",
      empty: "还没有消息",
      placeholder: "输入消息...",
      send: "发送",
      taskCreated: "已创建任务",
      taskSubmitted: "已提交任务",
      taskApproved: "任务已通过",
      taskRejected: "任务已拒绝",
      requestCreated: "已发起任务请求",
      requestRejected: "任务请求已拒绝",
    };
  }
  return {
    title: "Chat",
    sectionHint: "Real-time conversation and task updates.",
    online: "Online",
    connecting: "Connecting...",
    offline: "Offline",
    sending: "sending...",
    retry: "retry",
    empty: "No messages yet.",
    placeholder: "Type a message...",
    send: "Send",
    taskCreated: "Task created",
    taskSubmitted: "Task submitted",
    taskApproved: "Task approved",
    taskRejected: "Task rejected",
    requestCreated: "Task request created",
    requestRejected: "Task request rejected",
  };
}

function getSystemTaskText(message: ChatMessage, locale: string) {
  const copy = getChatCopy(locale);
  const action = message.content.action;
  const title = message.content.title || "Task";
  if (action === "task_created") return `${copy.taskCreated}: ${title}`;
  if (action === "task_submitted") return `${copy.taskSubmitted}: ${title}`;
  if (action === "task_approved") return `${copy.taskApproved}: ${title}`;
  if (action === "task_rejected") return `${copy.taskRejected}: ${title}`;
  if (action === "task_request_created") return `${copy.requestCreated}: ${title}`;
  if (action === "task_request_rejected") return `${copy.requestRejected}: ${title}`;
  return title;
}

export default function Dashboard() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const chatCopy = getChatCopy(locale);
  const screens = Grid.useBreakpoint();
  const isDesktop = Boolean(screens.lg);
  const taskRequestPresets = taskRequestPresetKeys.map((key) => t(key));
  const submissionFileInputId = "task-submission-file-input";
  const [token, setToken] = useState("");
  const [me, setMe] = useState<MeResponse | null>(null);
  const [relationship, setRelationship] = useState<RelationshipSummary | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskRequests, setTaskRequests] = useState<TaskRequest[]>([]);
  const [taskForm, setTaskForm] = useState<TaskFormState>(initialTask);
  const [taskSubmissionForm, setTaskSubmissionForm] = useState<TaskSubmissionFormState>(initialTaskSubmission);
  const [taskRequestForm, setTaskRequestForm] = useState<TaskRequestFormState>(initialTaskRequest);
  const [profileForm, setProfileForm] = useState<ProfileFormState>({
    display_name: "",
    gender: "private",
    seeking_gender: "any",
    sexual_orientation: "unspecified",
    identity_labels: [],
  });
  const [selectedTaskRequestId, setSelectedTaskRequestId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [skipBind, setSkipBind] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showTaskRequestModal, setShowTaskRequestModal] = useState(false);
  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false);
  const [submissionPreviewTask, setSubmissionPreviewTask] = useState<TaskSubmissionPreviewState>(null);
  const [activeSection, setActiveSection] = useState<DashboardSection>("overview");
  const [submissionPreviewUrl, setSubmissionPreviewUrl] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatStatus, setChatStatus] = useState<"idle" | "connecting" | "online" | "offline">("idle");
  const [unreadState, setUnreadState] = useState<UnreadState | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const shouldReconnectRef = useRef(false);
  const latestReadSentRef = useRef<string | null>(null);
  const chatViewportRef = useRef<HTMLDivElement | null>(null);
  const isChatActiveRef = useRef(false);
  const taskDeadlineValue = parseDeadlineValue(taskForm.deadline) ?? getDefaultDeadlineValue();
  const hourOptions = Array.from({ length: 24 }, (_, index) => {
    const value = String(index).padStart(2, "0");
    return { label: value, value };
  });
  const minuteOptions = ["00", "15", "30", "45"].map((value) => ({
    label: value,
    value,
  }));

  const formatGenderLabel = (value: User["gender"]) =>
    value === "male"
      ? t("gender.male")
      : value === "female"
      ? t("gender.female")
      : value === "trans"
      ? t("gender.trans")
      : value === "non_binary"
      ? t("gender.non_binary")
      : t("gender.private");
  const formatSeekingGenderLabel = (value: User["seeking_gender"]) =>
    value === "any" ? t("seeking_gender.any") : formatGenderLabel(value);
  const formatOrientationLabel = (value: User["sexual_orientation"]) =>
    value === "hetero"
      ? t("orientation.hetero")
      : value === "homo"
      ? t("orientation.homo")
      : value === "bi"
      ? t("orientation.bi")
      : value === "pan"
      ? t("orientation.pan")
      : value === "asexual"
      ? t("orientation.asexual")
      : value === "questioning"
      ? t("orientation.questioning")
      : t("orientation.unspecified");
  const formatIdentityLabel = (value: IdentityLabel) =>
    value === "lesbian"
      ? t("identity.lesbian")
      : value === "gay"
      ? t("identity.gay")
      : value === "femboy"
      ? t("identity.femboy")
      : value === "ts"
      ? t("identity.ts")
      : value === "cd"
      ? t("identity.cd")
      : t("identity.4i");

  useEffect(() => {
    setToken(window.localStorage.getItem(TOKEN_KEY) || "");
    setSkipBind(Boolean(window.sessionStorage.getItem(SKIP_BIND_KEY)));
    setAuthReady(true);
  }, []);

  useEffect(() => {
    if (!taskSubmissionForm.media_file) {
      setSubmissionPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(taskSubmissionForm.media_file);
    setSubmissionPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [taskSubmissionForm.media_file]);

  function mergeIncomingMessage(message: ChatMessage) {
    setChatMessages((current) => {
      const index = current.findIndex((item) => item.id === message.id);
      if (index >= 0) {
        const next = [...current];
        next[index] = { ...next[index], ...message, pending: false, failed: false };
        return next;
      }
      const pendingIndex = message.client_msg_id
        ? current.findIndex((item) => item.client_msg_id === message.client_msg_id && item.pending)
        : -1;
      if (pendingIndex >= 0) {
        const next = [...current];
        next[pendingIndex] = { ...message, pending: false, failed: false };
        return next;
      }
      return [...current, message];
    });
  }

  async function loadChatSnapshot(currentToken: string, relationshipId: string) {
    const [messagesResponse, unreadResponse] = await Promise.all([
      apiRequest(`/chat/messages?relationship_id=${encodeURIComponent(relationshipId)}&limit=50`, {
        token: currentToken,
      }) as Promise<{ messages?: ChatMessage[] }>,
      apiRequest(`/chat/unread?relationship_id=${encodeURIComponent(relationshipId)}`, {
        token: currentToken,
      }) as Promise<UnreadState>,
    ]);
    setChatMessages(messagesResponse.messages || []);
    setUnreadState(unreadResponse);
  }

  function clearReconnectTimer() {
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }

  function closeChatSocket() {
    clearReconnectTimer();
    shouldReconnectRef.current = false;
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
  }

  function sendReadUpdate(latestMessageId: string) {
    if (!token || !relationship) {
      return;
    }
    if (latestReadSentRef.current === latestMessageId) {
      return;
    }
    latestReadSentRef.current = latestMessageId;
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "chat.read.update", message_id: latestMessageId }));
      return;
    }
    void apiRequest("/chat/read", {
      method: "POST",
      token,
      body: {
        relationship_id: relationship.relationship.id,
        message_id: latestMessageId,
      },
    }).catch(() => {
      latestReadSentRef.current = null;
    });
  }

  function scheduleReconnect(currentToken: string, relationshipId: string) {
    if (!shouldReconnectRef.current) {
      return;
    }
    clearReconnectTimer();
    const attempt = reconnectAttemptRef.current;
    const delay = Math.min(1000 * 2 ** attempt, 15000);
    reconnectTimerRef.current = window.setTimeout(() => {
      connectChatSocket(currentToken, relationshipId);
    }, delay);
    reconnectAttemptRef.current += 1;
  }

  function connectChatSocket(currentToken: string, relationshipId: string) {
    closeChatSocket();
    shouldReconnectRef.current = true;
    setChatStatus("connecting");
    const ws = new WebSocket(
      `${WS_BASE_URL}/ws/relationships/${encodeURIComponent(relationshipId)}?token=${encodeURIComponent(currentToken)}`
    );
    socketRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptRef.current = 0;
      setChatStatus("online");
    };

    ws.onmessage = (event) => {
      let payload: unknown;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }
      if (!payload || typeof payload !== "object") {
        return;
      }
      const eventType = (payload as { type?: string }).type;
      if (eventType === "chat.message.new") {
        const incoming = (payload as { message?: ChatMessage }).message;
        if (incoming) {
          mergeIncomingMessage(incoming);
          if (isChatActiveRef.current) {
            sendReadUpdate(incoming.id);
          }
        }
        return;
      }
      if (eventType === "chat.message.ack") {
        const ack = payload as { client_msg_id?: string; message_id?: string; created_at?: string };
        if (!ack.client_msg_id || !ack.message_id) {
          return;
        }
        setChatMessages((current) =>
          current.map((message) =>
            message.client_msg_id === ack.client_msg_id
              ? {
                  ...message,
                  id: ack.message_id || message.id,
                  created_at: ack.created_at || message.created_at,
                  pending: false,
                  failed: false,
                }
              : message
          )
        );
        return;
      }
      if (eventType === "chat.unread.count") {
        const unreadPayload = payload as { unread_count?: number; relationship_id?: string };
        setUnreadState((current) => ({
          relationship_id: unreadPayload.relationship_id || current?.relationship_id || relationshipId,
          last_read_message_id: current?.last_read_message_id || null,
          last_read_at: current?.last_read_at || null,
          unread_count: Number(unreadPayload.unread_count || 0),
        }));
        return;
      }
      if (eventType === "chat.read.updated") {
        const readPayload = payload as { user_id?: string; last_read_message_id?: string; last_read_at?: string };
        if (readPayload.user_id === me?.user.id) {
          setUnreadState((current) =>
            current
              ? {
                  ...current,
                  last_read_message_id: readPayload.last_read_message_id || current.last_read_message_id,
                  last_read_at: readPayload.last_read_at || current.last_read_at,
                  unread_count: 0,
                }
              : current
          );
        }
        return;
      }
      if (eventType === "error") {
        const detail = (payload as { detail?: string }).detail;
        if (detail) {
          setNotice(detail);
        }
      }
    };

    ws.onclose = () => {
      setChatStatus("offline");
      if (shouldReconnectRef.current) {
        scheduleReconnect(currentToken, relationshipId);
      }
    };

    ws.onerror = () => {
      setChatStatus("offline");
    };
  }

  async function loadDashboard(currentToken: string) {
    const meResponse = (await apiRequest("/me", { token: currentToken })) as MeResponse;
    const normalizedUser = normalizeUser(meResponse.user);
    setMe({ ...meResponse, user: normalizedUser });
    setProfileForm({
      display_name: normalizedUser.display_name,
      gender: normalizedUser.gender,
      seeking_gender: normalizedUser.seeking_gender,
      sexual_orientation: normalizedUser.sexual_orientation,
      identity_labels: normalizedUser.identity_labels,
    });

    if (!meResponse.current_relationship) {
      setRelationship(null);
      setTasks([]);
      setTaskRequests([]);
      if (!window.sessionStorage.getItem(SKIP_BIND_KEY)) {
        router.replace("/bind");
      }
      return;
    }

    const relationshipResponse = (await apiRequest("/relationships/current", { token: currentToken })) as RelationshipSummary;
    setRelationship(relationshipResponse);

    const [taskResponse, taskRequestResponse] = await Promise.all([
      apiRequest(`/tasks?relationship_id=${encodeURIComponent(relationshipResponse.relationship.id)}`, {
        token: currentToken,
      }) as Promise<{ tasks?: Task[] }>,
      apiRequest(`/task-requests?relationship_id=${encodeURIComponent(relationshipResponse.relationship.id)}`, {
        token: currentToken,
      }) as Promise<{ task_requests?: TaskRequest[] }>,
    ]);

    setTasks(taskResponse.tasks || []);
    setTaskRequests(taskRequestResponse.task_requests || []);
  }

  useEffect(() => {
    if (!authReady) {
      return;
    }
    if (!token) {
      router.replace("/login");
      return;
    }

    let cancelled = false;

    async function run() {
      try {
        await loadDashboard(token);
      } catch (err) {
        if (cancelled) {
          return;
        }
        window.localStorage.removeItem(TOKEN_KEY);
        setToken("");
        const message = err instanceof Error ? err.message : t("common.request_failed");
        setNotice(translateApiError(message, t));
        router.replace("/login");
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [authReady, router, t, token]);

  async function refreshData() {
    if (!token) {
      return;
    }
    try {
      await loadDashboard(token);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("common.request_failed");
      setNotice(translateApiError(message, t));
    }
  }

  async function handleSaveProfile() {
    if (!token || !me) {
      return;
    }
    setBusy(true);
    try {
      const response = (await apiRequest("/me/profile", {
        method: "PATCH",
        token,
        body: {
          display_name: profileForm.display_name.trim(),
          gender: profileForm.gender,
          seeking_gender: profileForm.seeking_gender,
          sexual_orientation: profileForm.sexual_orientation,
          identity_labels: profileForm.identity_labels,
        },
      })) as { user: User };
      const normalizedUser = normalizeUser(response.user);
      setMe((current) => (current ? { ...current, user: normalizedUser } : current));
      setProfileForm({
        display_name: normalizedUser.display_name,
        gender: normalizedUser.gender,
        seeking_gender: normalizedUser.seeking_gender,
        sexual_orientation: normalizedUser.sexual_orientation,
        identity_labels: normalizedUser.identity_labels,
      });
      setNotice(t("profile.save_done"));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("common.request_failed");
      setNotice(translateApiError(message, t));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    isChatActiveRef.current = Boolean(
      relationship && (isDesktop || activeSection === "chat")
    );
    if (!isChatActiveRef.current) {
      return;
    }
    const latestMessage = [...chatMessages].reverse().find((item) => !item.pending);
    if (latestMessage) {
      sendReadUpdate(latestMessage.id);
    }
  }, [activeSection, chatMessages, isDesktop, relationship]);

  useEffect(() => {
    if (isDesktop && activeSection === "chat") {
      setActiveSection("overview");
    }
  }, [activeSection, isDesktop]);

  useEffect(() => {
    const viewport = chatViewportRef.current;
    if (!viewport || !isChatActiveRef.current) {
      return;
    }
    viewport.scrollTop = viewport.scrollHeight;
  }, [chatMessages, activeSection, isDesktop]);

  useEffect(() => {
    if (!token || !relationship) {
      closeChatSocket();
      setChatMessages([]);
      setUnreadState(null);
      setChatStatus("idle");
      return;
    }
    let cancelled = false;
    const relationshipId = relationship.relationship.id;
    latestReadSentRef.current = null;

    async function bootstrapChat() {
      try {
        await loadChatSnapshot(token, relationshipId);
      } catch (err) {
        if (cancelled) {
          return;
        }
        const message = err instanceof Error ? err.message : t("common.request_failed");
        setNotice(translateApiError(message, t));
      }
      if (!cancelled) {
        connectChatSocket(token, relationshipId);
      }
    }

    void bootstrapChat();
    return () => {
      cancelled = true;
      closeChatSocket();
    };
  }, [relationship?.relationship.id, token, t]);

  function logout() {
    closeChatSocket();
    window.localStorage.removeItem(TOKEN_KEY);
    window.sessionStorage.removeItem(SKIP_BIND_KEY);
    setSkipBind(false);
    setToken("");
    router.replace("/login");
  }

  function resetCreateTaskModal() {
    setShowCreateModal(false);
    setShowDeadlinePicker(false);
    setTaskForm(initialTask);
    setSelectedTaskRequestId(null);
  }

  function resetTaskRequestModal() {
    setShowTaskRequestModal(false);
    setTaskRequestForm(initialTaskRequest);
  }

  function resetSubmitTaskModal() {
    setShowSubmitModal(false);
    setTaskSubmissionForm(initialTaskSubmission);
  }

  function openSubmissionPreview(task: Task) {
    setSubmissionPreviewTask(task);
  }

  function closeSubmissionPreview() {
    setSubmissionPreviewTask(null);
  }

  function canOpenSubmissionPreview(task: Task) {
    return Boolean(task.submission_submitted_at && (task.submission_note || task.submission_media_url));
  }

  async function handleCreateTask() {
    if (!relationship || !token) {
      return;
    }

    setBusy(true);
    try {
      await apiRequest("/tasks", {
        method: "POST",
        token,
        body: {
          relationship_id: relationship.relationship.id,
          task_request_id: selectedTaskRequestId,
          title: taskForm.title,
          description: taskForm.description,
          deadline: toPayloadDate(taskForm.deadline),
          expected_submission_type: taskForm.expected_submission_type,
        },
      });
      resetCreateTaskModal();
      setNotice(t("dashboard.create_task_done"));
      await refreshData();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("common.request_failed");
      setNotice(translateApiError(message, t));
    } finally {
      setBusy(false);
    }
  }

  function openSubmitTaskModal(task: Task) {
    setTaskSubmissionForm({
      taskId: task.id,
      expected_submission_type: task.expected_submission_type,
      note: "",
      media_file: null,
    });
    setShowSubmitModal(true);
  }

  function updateTaskDeadline(nextValue: Dayjs) {
    setTaskForm((current) => ({
      ...current,
      deadline: nextValue.second(0).millisecond(0).format("YYYY-MM-DDTHH:mm"),
    }));
  }

  function updateTaskDeadlineDate(nextDate: Dayjs) {
    const base = parseDeadlineValue(taskForm.deadline) ?? getDefaultDeadlineValue();
    updateTaskDeadline(
      base
        .year(nextDate.year())
        .month(nextDate.month())
        .date(nextDate.date())
    );
  }

  function updateTaskDeadlineHour(hour: string) {
    const base = parseDeadlineValue(taskForm.deadline) ?? getDefaultDeadlineValue();
    updateTaskDeadline(base.hour(Number(hour)));
  }

  function updateTaskDeadlineMinute(minute: string) {
    const base = parseDeadlineValue(taskForm.deadline) ?? getDefaultDeadlineValue();
    updateTaskDeadline(base.minute(Number(minute)));
  }

  async function handleSubmitTask() {
    if (!token) {
      return;
    }
    if (!taskSubmissionForm.taskId) {
      return;
    }
    if (
      TASK_SUBMISSION_MAX_FILE_SIZE_BYTES !== null &&
      taskSubmissionForm.media_file &&
      taskSubmissionForm.media_file.size > TASK_SUBMISSION_MAX_FILE_SIZE_BYTES
    ) {
      setNotice(getSubmissionFileTooLargeMessage(TASK_SUBMISSION_MAX_FILE_SIZE_MB));
      return;
    }

    setBusy(true);
    try {
      const formData = new FormData();
      if (taskSubmissionForm.note.trim()) {
        formData.append("note", taskSubmissionForm.note.trim());
      }
      if (taskSubmissionForm.media_file) {
        formData.append("media_file", taskSubmissionForm.media_file);
      }
      await apiRequest(`/tasks/${taskSubmissionForm.taskId}/submit`, {
        method: "POST",
        token,
        body: formData,
      });
      resetSubmitTaskModal();
      setNotice(t("dashboard.task_submitted"));
      await refreshData();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("common.request_failed");
      if (message === "Request Entity Too Large") {
        setNotice(getSubmissionPayloadTooLargeMessage());
        return;
      }
      setNotice(translateApiError(message, t));
    } finally {
      setBusy(false);
    }
  }

  async function handleTaskAction(taskId: string, action: "approve" | "reject") {
    if (!token) {
      return;
    }

    setBusy(true);
    try {
      if (action === "approve") {
        await apiRequest(`/tasks/${taskId}/approve`, {
          method: "POST",
          token,
          body: {},
        });
        setNotice(t("dashboard.task_approved"));
      }
      if (action === "reject") {
        await apiRequest(`/tasks/${taskId}/reject`, {
          method: "POST",
          token,
          body: { reason: t("dashboard.reject_reason") },
        });
        setNotice(t("dashboard.task_rejected"));
      }
      await refreshData();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("common.request_failed");
      setNotice(translateApiError(message, t));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateTaskRequest() {
    if (!relationship || !token) {
      return;
    }

    setBusy(true);
    try {
      await apiRequest("/task-requests", {
        method: "POST",
        token,
        body: {
          relationship_id: relationship.relationship.id,
          title: taskRequestForm.title,
          note: taskRequestForm.note || null,
        },
      });
      resetTaskRequestModal();
      setNotice(t("dashboard.task_request_sent"));
      await refreshData();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("common.request_failed");
      setNotice(translateApiError(message, t));
    } finally {
      setBusy(false);
    }
  }

  async function handleRejectTaskRequest(taskRequestId: string) {
    if (!token) {
      return;
    }

    setBusy(true);
    try {
      await apiRequest(`/task-requests/${taskRequestId}/reject`, {
        method: "POST",
        token,
        body: { reason: t("dashboard.reject_reason") },
      });
      setNotice(t("dashboard.task_rejected"));
      await refreshData();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("common.request_failed");
      setNotice(translateApiError(message, t));
    } finally {
      setBusy(false);
    }
  }

  function sendChatMessage() {
    const text = chatInput.trim();
    if (!text || !relationship || !me) {
      return;
    }
    const clientMsgId = createClientMessageId();
    const optimisticMessage: ChatMessage = {
      id: `pending-${clientMsgId}`,
      relationship_id: relationship.relationship.id,
      sender_id: me.user.id,
      kind: "text",
      content: { text },
      created_at: new Date().toISOString(),
      client_msg_id: clientMsgId,
      pending: true,
      failed: false,
    };
    setChatMessages((current) => [...current, optimisticMessage]);
    setChatInput("");

    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setChatMessages((current) =>
        current.map((item) =>
          item.client_msg_id === clientMsgId ? { ...item, pending: false, failed: true } : item
        )
      );
      setChatStatus("offline");
      return;
    }

    socket.send(
      JSON.stringify({
        type: "chat.message.send",
        text,
        client_msg_id: clientMsgId,
      })
    );
  }

  function retryChatMessage(message: ChatMessage) {
    if (!message.failed || !message.content.text) {
      return;
    }
    setChatMessages((current) => current.filter((item) => item.id !== message.id));
    setChatInput(message.content.text);
  }

  function renderChatMessageItem(message: ChatMessage) {
    const mine = me?.user.id && message.sender_id === me.user.id;
    if (message.kind === "system_task") {
      return (
        <div key={message.id} className="dashboard-chat-message system">
          <Text>{getSystemTaskText(message, locale)}</Text>
          <Text type="secondary" className="dashboard-chat-time">{formatDateTime(message.created_at, locale)}</Text>
        </div>
      );
    }
    return (
      <div key={message.id} className={`dashboard-chat-message ${mine ? "mine" : "peer"}`}>
        <Text>{message.content.text}</Text>
        <div className="dashboard-chat-meta">
          <Text type="secondary" className="dashboard-chat-time">{formatDateTime(message.created_at, locale)}</Text>
          {message.pending ? <Text type="secondary">{chatCopy.sending}</Text> : null}
          {message.failed ? (
            <Button type="link" size="small" onClick={() => retryChatMessage(message)}>
              {chatCopy.retry}
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  const renderChatPanel = () => (
    <Card className="dashboard-chat-card">
      <div className="dashboard-chat-head">
        <div>
          <Title level={4}>{chatCopy.title}</Title>
          <Text type="secondary">
            {chatStatus === "online" ? chatCopy.online : chatStatus === "connecting" ? chatCopy.connecting : chatCopy.offline}
          </Text>
        </div>
        <Badge count={unreadState?.unread_count || 0} />
      </div>
      <div className="dashboard-chat-viewport" ref={chatViewportRef}>
        {chatMessages.length ? (
          chatMessages.map((message) => renderChatMessageItem(message))
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={chatCopy.empty} />
        )}
      </div>
      <div className="dashboard-chat-compose">
        <Input.TextArea
          value={chatInput}
          onChange={(event) => setChatInput(event.target.value)}
          placeholder={chatCopy.placeholder}
          autoSize={{ minRows: 2, maxRows: 4 }}
          onPressEnter={(event) => {
            if (!event.shiftKey) {
              event.preventDefault();
              sendChatMessage();
            }
          }}
        />
        <Button type="primary" icon={<SendOutlined />} onClick={sendChatMessage} disabled={!chatInput.trim()}>
          {chatCopy.send}
        </Button>
      </div>
    </Card>
  );

  function startFulfillingTaskRequest(taskRequest: TaskRequest) {
    setSelectedTaskRequestId(taskRequest.id);
    setTaskForm({
      title: taskRequest.title,
      description: taskRequest.note || taskRequest.title,
      deadline: "",
      expected_submission_type: "note",
    });
    setShowCreateModal(true);
  }

  if (!authReady || (token && !me)) {
    return <LoadingState message={t("common.loading_dashboard")} />;
  }

  if (!token) {
    return (
      <ErrorState
        title={t("dashboard.unauthenticated_title")}
        description={t("dashboard.unauthenticated_description")}
      />
    );
  }

  if (!me) {
    return <LoadingState message={t("common.loading_dashboard")} />;
  }

  const isSkipped = skipBind;
  const isOwner = relationship?.my_role_in_relationship === "owner";
  const isPuppy = relationship?.my_role_in_relationship === "puppy";
  const counterpartRoleLabel = isOwner ? t("role.puppy") : t("role.owner");
  const canCreateTask = isOwner && relationship?.relationship.status === "active";
  const openTasks = tasks.filter((task) => task.status === "open").length;
  const submittedTasks = tasks.filter((task) => task.status === "submitted").length;
  const approvedTasks = tasks.filter((task) => task.status === "approved").length;
  const pendingRequests = taskRequests.filter((item) => item.status === "pending").length;
  const unreadCount = unreadState?.unread_count || 0;

  const navItems: { key: DashboardSection; label: string; count?: number; icon: ReactNode }[] = [
    { key: "overview", label: t("dashboard.nav.overview"), icon: <span style={{ fontSize: 18 }}>🏠</span> },
    { key: "tasks", label: t("dashboard.nav.tasks"), count: openTasks, icon: <span style={{ fontSize: 18 }}>{isOwner ? "📋" : "🦴"}</span> },
    { key: "requests", label: t("dashboard.nav.requests"), count: pendingRequests, icon: <span style={{ fontSize: 18 }}>📬</span> },
    { key: "chat", label: chatCopy.title, count: unreadCount, icon: <span style={{ fontSize: 18 }}>💬</span> },
    { key: "profile", label: t("dashboard.nav.profile"), icon: <span style={{ fontSize: 18 }}>{isOwner ? "👑" : "🐾"}</span> },
  ];

  const sectionHints: Record<DashboardSection, string> = {
    overview: t("dashboard.section.overview_hint"),
    tasks: t("dashboard.section.tasks_hint"),
    requests: t("dashboard.section.requests_hint"),
    chat: chatCopy.sectionHint,
    profile: t("dashboard.section.profile_hint"),
  };

  const sectionTitles: Record<DashboardSection, string> = {
    overview: t("dashboard.nav.overview"),
    tasks: t("dashboard.nav.tasks"),
    requests: t("dashboard.nav.requests"),
    chat: chatCopy.title,
    profile: t("dashboard.nav.profile"),
  };

  const menuItems = navItems.map((item) => ({
    key: item.key,
    icon: item.icon,
    label: (
      <span className="dashboard-nav-label">
        <span>{item.label}</span>
        {item.count ? <Badge count={item.count} size="small" /> : null}
      </span>
    ),
  }));
  const visibleNavItems = isDesktop ? navItems.filter((item) => item.key !== "chat") : navItems;
  const visibleMenuItems = isDesktop ? menuItems.filter((item) => item.key !== "chat") : menuItems;

  const renderOverviewSection = () => (
    <div className="dashboard-section-stack">
      <Card className={`dashboard-mobile-hero ${isOwner ? "is-owner" : "is-puppy"}`}>
        <div className="dashboard-mobile-hero-head">
          <div>
            <p className="dashboard-mobile-hero-kicker">{sectionTitles.overview}</p>
            <h3 className="dashboard-mobile-hero-title">{relationship?.counterpart.display_name}</h3>
          </div>
          <Tag color={getRelationshipTagColor(relationship?.relationship.status || "")}>
            {relationship ? t(`dashboard.relationship_status.${relationship.relationship.status}` as never) : ""}
          </Tag>
        </div>
        <p className="dashboard-mobile-hero-copy">{sectionHints.overview}</p>
        {canCreateTask || isPuppy ? (
          <div className="dashboard-mobile-hero-actions">
            {canCreateTask ? (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setShowCreateModal(true)}
                className="dashboard-quick-action is-owner"
              >
                {t("dashboard.create_task")}
              </Button>
            ) : null}
            {isPuppy ? (
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={() => setShowTaskRequestModal(true)}
                className="dashboard-quick-action is-puppy"
              >
                {t("dashboard.request_task")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </Card>

      <div className="dashboard-stat-grid">
        <Card><Statistic title={t("dashboard.open_tasks")} value={openTasks} /></Card>
        <Card><Statistic title={t("dashboard.submitted_tasks")} value={submittedTasks} /></Card>
        <Card><Statistic title={t("dashboard.approved_tasks")} value={approvedTasks} /></Card>
        <Card><Statistic title={t("dashboard.wallet")} value={me.wallet.balance} suffix={t("dashboard.coins")} /></Card>
      </div>

      <Card className={`dashboard-relationship-card ${isOwner ? "is-owner" : "is-puppy"}`}>
        <div className="dashboard-relationship-top">
          <div className="dashboard-relationship-people">
            <div className="dashboard-person-chip">
              <div className="dashboard-avatar">{me.user.display_name.slice(0, 1).toUpperCase()}</div>
              <div className="dashboard-relationship-copy">
                <div className="dashboard-person-name-row">
                  <Title level={3}>{me.user.display_name}</Title>
                  <span className="dashboard-role-marker" aria-label={me.user.role_preference}>
                    {getRoleMarker(me.user.role_preference)}
                  </span>
                </div>
                <Text type="secondary">{me.user.email}</Text>
              </div>
            </div>
            <div className="dashboard-person-chip">
              <div className="dashboard-avatar">{relationship?.counterpart.display_name.slice(0, 1).toUpperCase()}</div>
              <div className="dashboard-relationship-copy">
                <div className="dashboard-person-name-row">
                  <Title level={3}>{relationship?.counterpart.display_name}</Title>
                  <span className="dashboard-role-marker" aria-label={isOwner ? "puppy" : "owner"}>
                    {getRoleMarker(isOwner ? "puppy" : "owner")}
                  </span>
                </div>
                <Text type="secondary">{relationship?.counterpart.email}</Text>
              </div>
            </div>
          </div>
          <Tag color={getRelationshipTagColor(relationship?.relationship.status || "")}>
            {relationship ? t(`dashboard.relationship_status.${relationship.relationship.status}` as never) : ""}
          </Tag>
        </div>

        <div className="dashboard-info-grid">
          <div className="dashboard-info-row"><Text type="secondary">{t("dashboard.intimacy")}</Text><strong>{relationship?.relationship.intimacy_score}</strong></div>
          <div className="dashboard-info-row"><Text type="secondary">{t("dashboard.invite_code")}</Text><strong>{me.user.invite_code}</strong></div>
          <div className="dashboard-info-row"><Text type="secondary">{t("dashboard.wallet")}</Text><strong>{me.wallet.balance} {t("dashboard.coins")}</strong></div>
        </div>
      </Card>
    </div>
  );

  const renderTasksSection = () => (
    <Card>
      <div className="dashboard-list-header">
        <div>
          <Title level={4}>{t("dashboard.task_list_title")}</Title>
          <Text type="secondary">{sectionHints.tasks}</Text>
        </div>
        <Space wrap>
          {canCreateTask ? <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowCreateModal(true)}>{t("dashboard.create_task")}</Button> : null}
          {isPuppy ? <Button icon={<SendOutlined />} onClick={() => setShowTaskRequestModal(true)}>{t("dashboard.request_task")}</Button> : null}
        </Space>
      </div>
      <div className="dashboard-list-divider" aria-hidden="true" />
      <List
        itemLayout="vertical"
        dataSource={tasks}
        pagination={{
          pageSize: 5,
          hideOnSinglePage: true,
          size: "small",
        }}
        locale={{
          emptyText: <Empty description={isOwner ? t("dashboard.empty_owner") : t("dashboard.empty_puppy")} image={Empty.PRESENTED_IMAGE_SIMPLE} />,
        }}
        renderItem={(task) => (
          <List.Item
            key={task.id}
            className={`dashboard-list-item${canOpenSubmissionPreview(task) ? " is-clickable" : ""}`}
            onClick={canOpenSubmissionPreview(task) ? () => openSubmissionPreview(task) : undefined}
          >
            <div className="dashboard-list-item-head">
              <div className="dashboard-list-item-copy">
                <div className="dashboard-list-item-title-row">
                  <Title level={5}>{task.title}</Title>
                  <Tag color={getTaskTagColor(task.status)}>{t(`dashboard.task_status.${task.status}`)}</Tag>
                </div>
                <Text type="secondary">{task.description}</Text>
              </div>
              <div className="dashboard-list-item-reward">🪙 +1</div>
            </div>
            <div className="dashboard-list-meta">
              <Text type="secondary">{t("dashboard.deadline")}</Text>
              <Text strong>{task.deadline ? formatDateTime(task.deadline, locale) : t("dashboard.no_deadline")}</Text>
            </div>
            <div className="dashboard-list-meta">
              <Text type="secondary">{t("dashboard.task_submission_requirement")}</Text>
              <Text strong>{t(`dashboard.task_submission_type.${task.expected_submission_type}` as never)}</Text>
            </div>
            {canOpenSubmissionPreview(task) ? (
              <div className="dashboard-list-meta is-stacked">
                <Text type="secondary">{t("dashboard.task_submission_link")}</Text>
              </div>
            ) : null}
            {(isPuppy && task.status === "open") || (isOwner && task.status === "submitted") ? (
              <Space wrap className="dashboard-list-actions" onClick={(event) => event.stopPropagation()}>
                {isPuppy && task.status === "open" ? <Button type="primary" onClick={() => openSubmitTaskModal(task)} loading={busy}>{t("dashboard.task_status.submitted")}</Button> : null}
                {isOwner && task.status === "submitted" ? (
                  <>
                    <Button type="primary" onClick={() => void handleTaskAction(task.id, "approve")} loading={busy}>{t("dashboard.task_status.approved")}</Button>
                    <Button onClick={() => void handleTaskAction(task.id, "reject")} disabled={busy}>{t("dashboard.task_status.rejected")}</Button>
                  </>
                ) : null}
              </Space>
            ) : null}
          </List.Item>
        )}
      />
    </Card>
  );

  const renderRequestsSection = () => (
    <Card>
      <div className="dashboard-list-header">
        <div>
          <Title level={4}>{isOwner ? t("dashboard.request_queue_title") : t("dashboard.my_requests_title")}</Title>
          <Text type="secondary">{sectionHints.requests}</Text>
        </div>
        {isPuppy ? <Button type="primary" icon={<SendOutlined />} onClick={() => setShowTaskRequestModal(true)}>{t("dashboard.request_task")}</Button> : null}
      </div>
      <div className="dashboard-list-divider" aria-hidden="true" />
      <List
        itemLayout="vertical"
        dataSource={taskRequests}
        pagination={{
          pageSize: 5,
          hideOnSinglePage: true,
          size: "small",
        }}
        locale={{
          emptyText: <Empty description={isOwner ? t("dashboard.task_request_empty_owner") : t("dashboard.task_request_empty_puppy")} image={Empty.PRESENTED_IMAGE_SIMPLE} />,
        }}
        renderItem={(item) => (
          <List.Item key={item.id} className="dashboard-list-item">
            <div className="dashboard-list-item-head">
              <div className="dashboard-list-item-copy">
                <div className="dashboard-list-item-title-row">
                  <Title level={5}>{item.title}</Title>
                  <Tag color={getTaskRequestTagColor(item.status)}>{t(`dashboard.task_request_status.${item.status}` as never)}</Tag>
                </div>
                {item.note ? <Text type="secondary">{item.note}</Text> : null}
              </div>
            </div>
            <div className="dashboard-list-meta is-stacked">
              <Text type="secondary">{formatDateTime(item.created_at, locale)}</Text>
              {item.linked_task_id ? <Text type="secondary">{t("dashboard.linked_task_label")}: {item.linked_task_id}</Text> : null}
            </div>
            {isOwner && item.status === "pending" ? (
              <Space wrap className="dashboard-list-actions">
                <Button type="primary" onClick={() => startFulfillingTaskRequest(item)} disabled={busy}>{t("dashboard.fulfill_task_request")}</Button>
                <Button onClick={() => void handleRejectTaskRequest(item.id)} disabled={busy}>{t("dashboard.reject_task_request")}</Button>
              </Space>
            ) : null}
          </List.Item>
        )}
      />
    </Card>
  );

  const renderProfileSection = () => (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Card>
        <div className="dashboard-list-header">
          <div>
            <Title level={4}>{t("dashboard.nav.profile")}</Title>
            <Text type="secondary">{sectionHints.profile}</Text>
          </div>
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={() => void refreshData()}>{t("common.refresh")}</Button>
            <Button icon={<LogoutOutlined />} onClick={logout}>{t("common.logout")}</Button>
          </Space>
        </div>
        <div className="dashboard-info-grid">
          <div className="dashboard-info-row"><Text type="secondary">{t("common.display_name")}</Text><strong>{me.user.display_name}</strong></div>
          <div className="dashboard-info-row"><Text type="secondary">{t("common.email")}</Text><strong>{me.user.email}</strong></div>
          <div className="dashboard-info-row"><Text type="secondary">{t("common.role_preference")}</Text><strong>{me.user.role_preference === "owner" ? t("role.owner") : t("role.puppy")}</strong></div>
          <div className="dashboard-info-row"><Text type="secondary">{t("common.gender")}</Text><strong>{formatGenderLabel(me.user.gender)}</strong></div>
          <div className="dashboard-info-row"><Text type="secondary">{t("common.seeking_gender")}</Text><strong>{formatSeekingGenderLabel(me.user.seeking_gender)}</strong></div>
          <div className="dashboard-info-row"><Text type="secondary">{t("common.sexual_orientation")}</Text><strong>{formatOrientationLabel(me.user.sexual_orientation)}</strong></div>
          <div className="dashboard-info-row">
            <Text type="secondary">{t("common.identity_labels")}</Text>
            <strong>{me.user.identity_labels.length > 0 ? me.user.identity_labels.map((label) => formatIdentityLabel(label)).join(", ") : "-"}</strong>
          </div>
        </div>
      </Card>

      <Card>
        <Form layout="vertical" onFinish={() => void handleSaveProfile()}>
          <Form.Item label={t("common.display_name")} required>
            <Input
              value={profileForm.display_name}
              onChange={(event) => setProfileForm((current) => ({ ...current, display_name: event.target.value }))}
            />
          </Form.Item>
          <Form.Item label={t("common.gender")} required>
            <Select
              value={profileForm.gender}
              onChange={(value) => setProfileForm((current) => ({ ...current, gender: value as User["gender"] }))}
              options={[
                { value: "male", label: t("gender.male") },
                { value: "female", label: t("gender.female") },
                { value: "trans", label: t("gender.trans") },
                { value: "non_binary", label: t("gender.non_binary") },
                { value: "private", label: t("gender.private") },
              ]}
            />
          </Form.Item>
          <Form.Item label={t("common.seeking_gender")} required>
            <Select
              value={profileForm.seeking_gender}
              onChange={(value) =>
                setProfileForm((current) => ({ ...current, seeking_gender: value as User["seeking_gender"] }))
              }
              options={[
                { value: "any", label: t("seeking_gender.any") },
                { value: "male", label: t("gender.male") },
                { value: "female", label: t("gender.female") },
                { value: "trans", label: t("gender.trans") },
                { value: "non_binary", label: t("gender.non_binary") },
              ]}
            />
          </Form.Item>
          <Form.Item label={t("common.sexual_orientation")} required>
            <Select
              value={profileForm.sexual_orientation}
              onChange={(value) =>
                setProfileForm((current) => ({ ...current, sexual_orientation: value as User["sexual_orientation"] }))
              }
              options={[
                { value: "hetero", label: t("orientation.hetero") },
                { value: "homo", label: t("orientation.homo") },
                { value: "bi", label: t("orientation.bi") },
                { value: "pan", label: t("orientation.pan") },
                { value: "asexual", label: t("orientation.asexual") },
                { value: "questioning", label: t("orientation.questioning") },
                { value: "unspecified", label: t("orientation.unspecified") },
              ]}
            />
          </Form.Item>
          <Form.Item label={`${t("common.identity_labels")}（可不选）`}>
            <div className="dashboard-profile-labels">
              {(["lesbian", "gay", "femboy", "ts", "cd", "4i"] as const).map((label) => (
                <Tag.CheckableTag
                  key={label}
                  className="dashboard-profile-label-chip"
                  checked={profileForm.identity_labels.includes(label)}
                  onChange={() =>
                    setProfileForm((current) => ({
                      ...current,
                      identity_labels: toggleIdentityLabel(current.identity_labels, label),
                    }))
                  }
                >
                  {formatIdentityLabel(label)}
                </Tag.CheckableTag>
              ))}
            </div>
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={busy} disabled={!profileForm.display_name.trim()}>
            {busy ? t("profile.saving") : t("profile.save")}
          </Button>
        </Form>
      </Card>
    </Space>
  );

  const renderSectionContent = () => {
    if (!relationship) {
      return null;
    }
    if (activeSection === "tasks") {
      return renderTasksSection();
    }
    if (activeSection === "requests") {
      return renderRequestsSection();
    }
    if (activeSection === "chat") {
      return renderChatPanel();
    }
    if (activeSection === "profile") {
      return renderProfileSection();
    }
    return renderOverviewSection();
  };

  return (
    <div
      className={`dashboard-page-shell ${me.user.role_preference === "owner" ? "theme-owner" : "theme-puppy"}`}
      data-role={me.user.role_preference}
    >
      <header className="dashboard-topbar">
        <div className="dashboard-topbar-title">
          <span className="dashboard-topbar-kicker">{sectionTitles[activeSection]}</span>
          <Title level={2}>
            {me.user.role_preference === "owner" ? "🔗\u00a0" : "🐾\u00a0"}
            {t("dashboard.title")}
          </Title>
          <Text type="secondary">{me.user.email}</Text>
        </div>
        <Space wrap className="dashboard-topbar-actions">
          <LanguageSwitcher id="dashboard-language" />
          <Button icon={<ReloadOutlined />} onClick={() => void refreshData()}>{t("common.refresh")}</Button>
          <Button icon={<LogoutOutlined />} onClick={logout} danger>{t("common.logout")}</Button>
        </Space>
      </header>

      {notice ? <Alert className="dashboard-notice" message={notice} type="info" closable onClose={() => setNotice("")} showIcon /> : null}

      {!relationship ? (
        <Card className="dashboard-empty-card">
          <div className="dashboard-list-header">
            <div>
              <Title level={3}>{t("dashboard.no_relationship_title")}</Title>
              <Text type="secondary">{isSkipped ? t("dashboard.binding_reminder") : t("dashboard.no_relationship_description")}</Text>
            </div>
            <Space wrap>
              <Button type="primary" icon={<LinkOutlined />} onClick={() => router.replace("/match/swipe")}>
                {t("dashboard.open_match_plaza")}
              </Button>
              <Button onClick={() => router.replace("/bind?tab=invite")}>{t("dashboard.bind_by_invite")}</Button>
            </Space>
          </div>
          <div className="dashboard-info-grid">
            <div className="dashboard-info-row"><Text type="secondary">{t("common.display_name")}</Text><strong>{me.user.display_name}</strong></div>
            <div className="dashboard-info-row"><Text type="secondary">{t("dashboard.invite_code")}</Text><strong>{me.user.invite_code}</strong></div>
            <div className="dashboard-info-row"><Text type="secondary">{t("common.role_preference")}</Text><strong>{me.user.role_preference === "owner" ? t("role.owner") : t("role.puppy")}</strong></div>
          </div>
        </Card>
      ) : (
        <>
          <Layout className="dashboard-layout">
            {isDesktop ? (
              <Sider width={280} breakpoint="lg" collapsedWidth={0} className="dashboard-sider">
                <Card className={`dashboard-sider-card ${isOwner ? "is-owner" : "is-puppy"}`}>
                  <div className="dashboard-sider-head">
                    <Text type="secondary" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em" }}>
                      {isOwner ? "🐾 " : "🔗 "}{counterpartRoleLabel}
                    </Text>
                    <Title level={4}>{relationship.counterpart.display_name}</Title>
                    <Text type="secondary" style={{ fontSize: 12 }}>{sectionHints[activeSection]}</Text>
                  </div>
                  <Menu mode="inline" selectedKeys={[activeSection]} items={visibleMenuItems} onClick={({ key }) => setActiveSection(key as DashboardSection)} className="dashboard-menu" />
                </Card>
              </Sider>
            ) : null}
            <Content className="dashboard-content">
              <div className={`dashboard-main-grid${isDesktop ? " with-chat" : ""}`}>
                <div className="dashboard-main-column">
                  <div className="dashboard-section-head">
                    <div>
                      <Title level={3}>{sectionTitles[activeSection]}</Title>
                      <Text type="secondary">{sectionHints[activeSection]}</Text>
                    </div>
                    {activeSection === "overview" && (canCreateTask || isPuppy) ? (
                      <Space wrap className="dashboard-quick-action-wrap">
                        {canCreateTask ? (
                          <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => setShowCreateModal(true)}
                            className="dashboard-quick-action is-owner"
                            size="large"
                          >
                            {t("dashboard.create_task")}
                          </Button>
                        ) : null}
                        {isPuppy ? (
                          <Button
                            type="primary"
                            icon={<SendOutlined />}
                            onClick={() => setShowTaskRequestModal(true)}
                            className="dashboard-quick-action is-puppy"
                            size="large"
                          >
                            {t("dashboard.request_task")}
                          </Button>
                        ) : null}
                      </Space>
                    ) : null}
                  </div>
                  {renderSectionContent()}
                </div>
                {isDesktop ? <aside className="dashboard-chat-sidebar">{renderChatPanel()}</aside> : null}
              </div>
            </Content>
          </Layout>

          {!isDesktop ? (
            <>
              <div className="dashboard-mobile-nav-spacer" aria-hidden="true" />
              <nav className="dashboard-mobile-nav" aria-label={t("common.app_name")}>
                {visibleNavItems.map((item) => (
                  <button key={item.key} type="button" className={`dashboard-mobile-nav-item${activeSection === item.key ? " is-active" : ""}`} onClick={() => setActiveSection(item.key)}>
                    <span className="dashboard-mobile-nav-icon">{item.count ? <Badge count={item.count}>{item.icon}</Badge> : item.icon}</span>
                    <span className="dashboard-mobile-nav-text">{item.label}</span>
                  </button>
                ))}
              </nav>
            </>
          ) : null}
        </>
      )}

      <Modal open={showCreateModal} onCancel={resetCreateTaskModal} footer={null} title={t("dashboard.create_task_modal")} destroyOnHidden wrapClassName="dashboard-sheet-modal">
        <Form layout="vertical" onFinish={() => void handleCreateTask()}>
          <Form.Item label={t("dashboard.task_title")} required>
            <Input value={taskForm.title} placeholder={t("dashboard.task_title_placeholder")} onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))} />
          </Form.Item>
          <Form.Item label={t("dashboard.task_description")} required>
            <TextArea rows={4} value={taskForm.description} placeholder={t("dashboard.task_description_placeholder")} onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))} />
          </Form.Item>
          <Form.Item>
            <Text type="secondary">{t("dashboard.reward_rule_hint")}</Text>
          </Form.Item>
          <div className="dashboard-modal-grid">
            <Form.Item label={t("dashboard.deadline")}>
              <div className="dashboard-deadline-field">
                <button
                  type="button"
                  className="dashboard-deadline-trigger"
                  onClick={() => setShowDeadlinePicker(true)}
                >
                  <span className="dashboard-deadline-trigger-icon">
                    <ClockCircleOutlined />
                  </span>
                  <span className="dashboard-deadline-trigger-copy">
                    <span className="dashboard-deadline-trigger-label">{t("dashboard.deadline")}</span>
                    <span className="dashboard-deadline-trigger-value">
                      {taskForm.deadline ? formatDateTime(taskDeadlineValue.format(), locale) : t("dashboard.no_deadline")}
                    </span>
                  </span>
                </button>
                {taskForm.deadline ? (
                  <Button
                    type="text"
                    size="small"
                    onClick={() =>
                      setTaskForm((current) => ({
                        ...current,
                        deadline: "",
                      }))
                    }
                  >
                    {t("dashboard.clear_deadline")}
                  </Button>
                ) : null}
              </div>
            </Form.Item>
          </div>
          <Form.Item label={t("dashboard.task_submission_requirement")} required>
            <Space wrap>
              {(["note", "image", "video"] as const).map((type) => (
                <Button key={type} type={taskForm.expected_submission_type === type ? "primary" : "default"} onClick={() => setTaskForm((current) => ({ ...current, expected_submission_type: type }))}>
                  {t(`dashboard.task_submission_type.${type}` as never)}
                </Button>
              ))}
            </Space>
          </Form.Item>
          <div className="dashboard-modal-actions">
            <Button onClick={resetCreateTaskModal}>{t("common.cancel")}</Button>
            <Button type="primary" htmlType="submit" loading={busy} disabled={!taskForm.title.trim() || !taskForm.description.trim()}>{t("dashboard.create_task")}</Button>
          </div>
        </Form>
      </Modal>

      <Modal
        open={showDeadlinePicker}
        onCancel={() => setShowDeadlinePicker(false)}
        footer={null}
        title={t("dashboard.deadline")}
        destroyOnHidden
        width={isDesktop ? 560 : undefined}
        wrapClassName="dashboard-sheet-modal"
      >
        <div className="dashboard-deadline-picker">
          <Calendar
            fullscreen={false}
            value={taskDeadlineValue}
            onSelect={updateTaskDeadlineDate}
          />
          <div className="dashboard-deadline-time-grid">
            <div>
              <Text type="secondary">HH</Text>
              <Select
                value={taskDeadlineValue.format("HH")}
                options={hourOptions}
                onChange={updateTaskDeadlineHour}
                style={{ width: "100%", marginTop: 8 }}
              />
            </div>
            <div>
              <Text type="secondary">MM</Text>
              <Select
                value={taskDeadlineValue.format("mm")}
                options={minuteOptions}
                onChange={updateTaskDeadlineMinute}
                style={{ width: "100%", marginTop: 8 }}
              />
            </div>
          </div>
          <div className="dashboard-deadline-preview">
            <Text type="secondary">
              {taskForm.deadline ? formatDateTime(taskDeadlineValue.format(), locale) : t("dashboard.no_deadline")}
            </Text>
          </div>
          <div className="dashboard-modal-actions">
            {taskForm.deadline ? (
              <Button
                className="dashboard-deadline-clear-btn"
                onClick={() =>
                  setTaskForm((current) => ({
                    ...current,
                    deadline: "",
                  }))
                }
              >
                {t("dashboard.clear_deadline")}
              </Button>
            ) : null}
            <Button type="primary" onClick={() => setShowDeadlinePicker(false)}>
              {t("common.confirm")}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(submissionPreviewTask)}
        onCancel={closeSubmissionPreview}
        footer={null}
        title={submissionPreviewTask?.title || t("dashboard.task_submission_link")}
        destroyOnHidden
        width={isDesktop ? 720 : undefined}
        wrapClassName="dashboard-sheet-modal"
      >
        {submissionPreviewTask ? (
          <div className="dashboard-submission-preview">
            <div className="dashboard-submission-preview-card">
              <Text type="secondary">{t("dashboard.task_status.submitted")}</Text>
              <Text strong>
                {t(`dashboard.task_status.${submissionPreviewTask.status}`)}
              </Text>
            </div>
            <div className="dashboard-submission-preview-card">
              <Text type="secondary">{t("dashboard.task_submission_requirement")}</Text>
              <Text strong>
                {t(`dashboard.task_submission_type.${submissionPreviewTask.expected_submission_type}` as never)}
              </Text>
            </div>
            {submissionPreviewTask.submission_submitted_at ? (
              <div className="dashboard-submission-preview-card">
                <Text type="secondary">{t("dashboard.submitted_at")}</Text>
                <Text strong>{formatDateTime(submissionPreviewTask.submission_submitted_at, locale)}</Text>
              </div>
            ) : null}
            {submissionPreviewTask.submission_note ? (
              <div className="dashboard-submission-preview-card">
                <Text type="secondary">{t("dashboard.task_submission_note")}</Text>
                <Text>{submissionPreviewTask.submission_note}</Text>
              </div>
            ) : null}
            {submissionPreviewTask.submission_media_url ? (
              <div className="dashboard-submission-preview-card">
                <Text type="secondary">{t("dashboard.task_submission_link")}</Text>
                {submissionPreviewTask.submission_media_type === "video" ? (
                  <video
                    src={toAssetUrl(submissionPreviewTask.submission_media_url)}
                    controls
                    playsInline
                    className="dashboard-submission-preview-media is-video"
                  />
                ) : (
                  <img
                    src={toAssetUrl(submissionPreviewTask.submission_media_url)}
                    alt={submissionPreviewTask.title}
                    className="dashboard-submission-preview-media"
                  />
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={showSubmitModal}
        onCancel={resetSubmitTaskModal}
        footer={null}
        title={t("dashboard.submit_task_modal")}
        destroyOnHidden
        styles={{
          body: {
            maxHeight: isDesktop ? "70vh" : "calc(100vh - 180px)",
            overflowY: "auto",
            paddingBottom: isDesktop ? undefined : "calc(16px + env(safe-area-inset-bottom, 0px))",
          },
        }}
        wrapClassName="dashboard-sheet-modal"
      >
        <Form layout="vertical" onFinish={() => void handleSubmitTask()}>
          <Form.Item label={t("dashboard.task_submission_requirement")}>
            <Text strong>{t(`dashboard.task_submission_type.${taskSubmissionForm.expected_submission_type}` as never)}</Text>
          </Form.Item>
          <Form.Item label={t("dashboard.task_submission_note")}>
            <TextArea rows={4} value={taskSubmissionForm.note} placeholder={t("dashboard.task_submission_note_placeholder")} onChange={(event) => setTaskSubmissionForm((current) => ({ ...current, note: event.target.value }))} />
          </Form.Item>
          {needsMediaSubmission(taskSubmissionForm.expected_submission_type) ? (
            <Form.Item label={t("dashboard.task_submission_media_url")} required>
              <div className="dashboard-upload-field">
                <input
                  id={submissionFileInputId}
                  className="dashboard-upload-input"
                  type="file"
                  accept={taskSubmissionForm.expected_submission_type === "image" ? "image/*" : "video/*"}
                  onChange={(event) => {
                    const selectedFile = event.target.files?.[0] || null;
                    if (!selectedFile) {
                      setTaskSubmissionForm((current) => ({
                        ...current,
                        media_file: null,
                      }));
                      return;
                    }
                    if (
                      TASK_SUBMISSION_MAX_FILE_SIZE_BYTES !== null &&
                      selectedFile.size > TASK_SUBMISSION_MAX_FILE_SIZE_BYTES
                    ) {
                      event.target.value = "";
                      setTaskSubmissionForm((current) => ({
                        ...current,
                        media_file: null,
                      }));
                      setNotice(getSubmissionFileTooLargeMessage(TASK_SUBMISSION_MAX_FILE_SIZE_MB));
                      return;
                    }
                    setTaskSubmissionForm((current) => ({
                      ...current,
                      media_file: selectedFile,
                    }));
                  }}
                />
                <label htmlFor={submissionFileInputId} className="dashboard-upload-trigger">
                  {getSubmissionPickerLabel(taskSubmissionForm.expected_submission_type, t)}
                </label>
                <Text type={taskSubmissionForm.media_file ? undefined : "secondary"} className="dashboard-upload-file-name">
                  {taskSubmissionForm.media_file?.name || t("dashboard.task_submission_no_file")}
                </Text>
                <Text type="secondary" className="dashboard-upload-hint">
                  {[getSubmissionHelperText(taskSubmissionForm.expected_submission_type, t), getSubmissionFileSizeHint(TASK_SUBMISSION_MAX_FILE_SIZE_MB)]
                    .filter(Boolean)
                    .join(" ")}
                </Text>
                {submissionPreviewUrl ? (
                  taskSubmissionForm.expected_submission_type === "image" ? (
                    <img
                      src={submissionPreviewUrl}
                      alt={taskSubmissionForm.media_file?.name || "selected image"}
                      style={{
                        width: "100%",
                        maxHeight: "280px",
                        objectFit: "contain",
                        borderRadius: "12px",
                        marginTop: "12px",
                        border: "1px solid var(--line)",
                        background: "var(--surface-subtle)",
                      }}
                    />
                  ) : (
                    <video
                      src={submissionPreviewUrl}
                      controls
                      playsInline
                      style={{
                        width: "100%",
                        maxHeight: "280px",
                        borderRadius: "12px",
                        marginTop: "12px",
                        border: "1px solid var(--line)",
                        background: "#000",
                      }}
                    />
                  )
                ) : null}
              </div>
            </Form.Item>
          ) : null}
          <div className="dashboard-modal-actions">
            <Button onClick={resetSubmitTaskModal}>{t("common.cancel")}</Button>
            <Button type="primary" htmlType="submit" loading={busy} disabled={needsMediaSubmission(taskSubmissionForm.expected_submission_type) && !taskSubmissionForm.media_file}>{t("dashboard.task_status.submitted")}</Button>
          </div>
        </Form>
      </Modal>

      <Modal open={showTaskRequestModal} onCancel={resetTaskRequestModal} footer={null} title={t("dashboard.task_request_modal")} destroyOnHidden wrapClassName="dashboard-sheet-modal">
        <Form layout="vertical" onFinish={() => void handleCreateTaskRequest()}>
          <Form.Item label={t("dashboard.task_request_title")} required>
            <Input value={taskRequestForm.title} placeholder={t("dashboard.task_request_title_placeholder")} onChange={(event) => setTaskRequestForm((current) => ({ ...current, title: event.target.value }))} />
          </Form.Item>
          <div className="dashboard-preset-row">
            {taskRequestPresets.map((preset) => (
              <Button key={preset} type="default" size="small" onClick={() => setTaskRequestForm((current) => ({ ...current, title: preset }))}>{preset}</Button>
            ))}
          </div>
          <Form.Item label={t("dashboard.task_request_note")}>
            <TextArea rows={4} value={taskRequestForm.note} placeholder={t("dashboard.task_request_note_placeholder")} onChange={(event) => setTaskRequestForm((current) => ({ ...current, note: event.target.value }))} />
          </Form.Item>
          <div className="dashboard-modal-actions">
            <Button onClick={resetTaskRequestModal}>{t("common.cancel")}</Button>
            <Button type="primary" htmlType="submit" loading={busy} disabled={!taskRequestForm.title.trim()}>{t("dashboard.request_task")}</Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}

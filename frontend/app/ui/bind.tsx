"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import type { MessageKey } from "../../lib/i18n/messages";
import { translateApiError } from "../../lib/i18n/api-errors";
import { useI18n } from "../../lib/i18n/useI18n";
import { Badge } from "./Badge";
import { Button, ButtonGroup } from "./Button";
import { Card, CardBody, CardHeader } from "./Card";
import { ErrorState } from "./ErrorState";
import { FormField, Input, Select } from "./FormField";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { LoadingState } from "./LoadingState";
import "./bind.css";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
const TOKEN_KEY = "puppy_token";
const ONBOARDING_KEY = "puppy_onboarding";
const SKIP_BIND_KEY = "puppy_skip_bind";

type UserSummary = {
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

type RelationshipSummary = {
  id: string;
};

type MeResponse = {
  user: UserSummary;
  current_relationship?: RelationshipSummary | null;
};

type MatchPost = {
  id: string;
  user_id: string;
  role_preference: "owner" | "puppy";
  intro: string;
  image_url?: string | null;
  status: "active" | "closed" | "matched";
  created_at: string;
  display_name?: string;
  has_pending_request?: boolean;
  gender?: UserSummary["gender"];
  seeking_gender?: UserSummary["seeking_gender"];
  sexual_orientation?: UserSummary["sexual_orientation"];
  identity_labels?: UserSummary["identity_labels"];
};

type MatchRequestInboxItem = {
  id: string;
  post_id: string;
  requester_id: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  message?: string | null;
  reject_reason_code?: string | null;
  requester_display_name: string;
  requester_role_preference: "owner" | "puppy";
  created_at: string;
};

type MatchRequestSentItem = {
  id: string;
  post_id: string;
  requester_id: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  message?: string | null;
  reject_reason_code?: string | null;
  target_user_id: string;
  target_display_name: string;
  target_role_preference: "owner" | "puppy";
  created_at: string;
};

type ApiErrorDetail = string | { code?: string; message?: string } | undefined;
type MatchCommunityView = "feed" | "inbox" | "mine";
type IdentityLabel = "lesbian" | "gay" | "femboy" | "ts" | "cd" | "4i";
type ProfileFormState = {
  display_name: string;
  gender: UserSummary["gender"];
  seeking_gender: UserSummary["seeking_gender"];
  sexual_orientation: UserSummary["sexual_orientation"];
  identity_labels: IdentityLabel[];
};

class ApiRequestError extends Error {
  detail: ApiErrorDetail;

  constructor(detail: ApiErrorDetail) {
    super(typeof detail === "string" ? detail : detail?.message || "Request failed");
    this.name = "ApiRequestError";
    this.detail = detail;
  }
}

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
  if (typeof window !== "undefined") {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timezone) {
      headers["X-User-Timezone"] = timezone;
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
    cache: "no-store",
  });

  const data = (await response.json().catch(() => ({}))) as { detail?: ApiErrorDetail };
  if (!response.ok) {
    throw new ApiRequestError(data.detail || "Request failed");
  }
  return data;
}

function readOnboarding(): Partial<UserSummary> | null {
  try {
    const raw = window.sessionStorage.getItem(ONBOARDING_KEY);
    return raw ? (JSON.parse(raw) as Partial<UserSummary>) : null;
  } catch {
    return null;
  }
}

function getErrorDetail(error: unknown): ApiErrorDetail {
  if (error instanceof ApiRequestError) {
    return error.detail;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return undefined;
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function isSameLocalDay(value: string) {
  const date = new Date(value);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function toBadgeStatus(status: string): "pending" | "approved" | "rejected" {
  if (status === "pending") {
    return "pending";
  }
  if (status === "accepted") {
    return "approved";
  }
  return "rejected";
}

function getMatchRequestStatusLabel(
  status: MatchRequestInboxItem["status"],
  t: (key: MessageKey) => string
) {
  if (status === "pending") {
    return t("bind.match_status.pending");
  }
  if (status === "accepted") {
    return t("bind.match_status.accepted");
  }
  if (status === "rejected") {
    return t("bind.match_status.rejected");
  }
  return t("bind.match_status.cancelled");
}

function getInitialLetter(value: string | undefined) {
  const candidate = value?.trim();
  return candidate ? candidate.slice(0, 1).toUpperCase() : "?";
}

function toAssetUrl(url: string) {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `${API_BASE_URL}${url}`;
}

function toggleIdentityLabel(current: IdentityLabel[], label: IdentityLabel) {
  if (current.includes(label)) {
    return current.filter((item) => item !== label);
  }
  return [...current, label];
}

function formatGenderLabel(value: UserSummary["gender"], t: (key: MessageKey) => string) {
  if (value === "male") return t("gender.male");
  if (value === "female") return t("gender.female");
  if (value === "trans") return t("gender.trans");
  if (value === "non_binary") return t("gender.non_binary");
  return t("gender.private");
}

function formatSeekingGenderLabel(value: UserSummary["seeking_gender"], t: (key: MessageKey) => string) {
  if (value === "any") return t("seeking_gender.any");
  return formatGenderLabel(value, t);
}

function formatOrientationLabel(value: UserSummary["sexual_orientation"], t: (key: MessageKey) => string) {
  if (value === "hetero") return t("orientation.hetero");
  if (value === "homo") return t("orientation.homo");
  if (value === "bi") return t("orientation.bi");
  if (value === "pan") return t("orientation.pan");
  if (value === "asexual") return t("orientation.asexual");
  if (value === "questioning") return t("orientation.questioning");
  return t("orientation.unspecified");
}

function formatIdentityLabel(value: IdentityLabel, t: (key: MessageKey) => string) {
  if (value === "lesbian") return t("identity.lesbian");
  if (value === "gay") return t("identity.gay");
  if (value === "femboy") return t("identity.femboy");
  if (value === "ts") return t("identity.ts");
  if (value === "cd") return t("identity.cd");
  return t("identity.4i");
}

function normalizeUserSummary(user: Partial<UserSummary>): UserSummary {
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

type BindPanelProps = {
  source?: string;
  tab?: string;
};

export default function BindPanel({ source, tab }: BindPanelProps) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const [token, setToken] = useState("");
  const [me, setMe] = useState<MeResponse | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState<"match" | "invite" | "profile">(
    tab === "invite" ? "invite" : tab === "profile" ? "profile" : "match"
  );
  const [activeMatchView, setActiveMatchView] = useState<MatchCommunityView>("feed");
  const [showComposer, setShowComposer] = useState(false);
  const [myPost, setMyPost] = useState<MatchPost | null>(null);
  const [postIntro, setPostIntro] = useState("");
  const [postImageFile, setPostImageFile] = useState<File | null>(null);
  const [postImagePreviewUrl, setPostImagePreviewUrl] = useState<string | null>(null);
  const [posts, setPosts] = useState<MatchPost[]>([]);
  const [inbox, setInbox] = useState<MatchRequestInboxItem[]>([]);
  const [sent, setSent] = useState<MatchRequestSentItem[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [requestMessages, setRequestMessages] = useState<Record<string, string>>({});
  const [profileForm, setProfileForm] = useState<ProfileFormState>({
    display_name: "",
    gender: "private",
    seeking_gender: "any",
    sexual_orientation: "unspecified",
    identity_labels: [],
  });

  useEffect(() => {
    const currentToken = window.localStorage.getItem(TOKEN_KEY) || "";
    if (!currentToken) {
      router.replace("/login");
      return;
    }
    setToken(currentToken);

    const onboarding = readOnboarding();
    if (onboarding?.email && onboarding?.display_name && onboarding?.role_preference && onboarding?.invite_code) {
      setMe({
        user: normalizeUserSummary(onboarding),
        current_relationship: null,
      });
    }
    setHydrated(true);
  }, [router]);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    async function loadMe() {
      try {
        const response = (await apiRequest("/me", { token })) as MeResponse;
        if (cancelled) {
          return;
        }
        const normalizedUser = normalizeUserSummary(response.user);
        setMe({ ...response, user: normalizedUser });
        setProfileForm({
          display_name: normalizedUser.display_name,
          gender: normalizedUser.gender,
          seeking_gender: normalizedUser.seeking_gender,
          sexual_orientation: normalizedUser.sexual_orientation,
          identity_labels: normalizedUser.identity_labels,
        });
        if (response.current_relationship) {
          router.replace("/dashboard");
        }
      } catch (err) {
        if (cancelled) {
          return;
        }
        window.localStorage.removeItem(TOKEN_KEY);
        setError(translateApiError(getErrorDetail(err), t));
      }
    }

    void loadMe();
    return () => {
      cancelled = true;
    };
  }, [router, t, token]);

  const dailySentCount = useMemo(() => sent.filter((item) => isSameLocalDay(item.created_at)).length, [sent]);

  useEffect(() => {
    if (!postImageFile) {
      setPostImagePreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(postImageFile);
    setPostImagePreviewUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [postImageFile]);

  async function refreshMatchData(currentToken: string) {
    const [postsResponse, inboxResponse, sentResponse] = await Promise.all([
      apiRequest("/match/posts", { token: currentToken }) as Promise<{ posts: MatchPost[] }>,
      apiRequest("/match/requests/inbox", { token: currentToken }) as Promise<{
        requests: MatchRequestInboxItem[];
        pending_count: number;
      }>,
      apiRequest("/match/requests/sent", { token: currentToken }) as Promise<{ requests: MatchRequestSentItem[] }>,
    ]);
    setPosts((postsResponse.posts || []).filter((post) => !post.has_pending_request));
    setInbox(inboxResponse.requests || []);
    setSent(sentResponse.requests || []);
    setPendingCount(inboxResponse.pending_count || 0);
  }

  useEffect(() => {
    if (!token || !me) {
      return;
    }
    const meUserId = me.user.id;
    let cancelled = false;
    async function loadMatchData() {
      try {
        const [myPostResponse] = await Promise.all([
          apiRequest("/match/posts?limit=100&include_mine=true", { token }) as Promise<{ posts: MatchPost[] }>,
          refreshMatchData(token),
        ]);
        if (cancelled) {
          return;
        }
        const own = (myPostResponse.posts || []).find((post) => post.user_id === meUserId) || null;
        setMyPost(own);
      } catch (err) {
        if (cancelled) {
          return;
        }
        setError(translateApiError(getErrorDetail(err), t));
      }
    }
    void loadMatchData();
    return () => {
      cancelled = true;
    };
  }, [me, t, token]);

  useEffect(() => {
    if (!token) {
      return;
    }
    const wsBaseUrl = API_BASE_URL.startsWith("https://")
      ? `wss://${API_BASE_URL.slice("https://".length)}`
      : API_BASE_URL.startsWith("http://")
      ? `ws://${API_BASE_URL.slice("http://".length)}`
      : API_BASE_URL;
    const socket = new WebSocket(`${wsBaseUrl}/ws/notifications?token=${encodeURIComponent(token)}`);
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { type?: string; pending_count?: number };
        if (payload.type === "match.request.new") {
          setNotice(t("bind.match_pending_count"));
          void refreshMatchData(token);
          return;
        }
        if (payload.type === "match.request.updated" || payload.type === "match.request.pending_count") {
          if (typeof payload.pending_count === "number") {
            setPendingCount(payload.pending_count);
          }
          void refreshMatchData(token);
        }
      } catch {
        // Ignore malformed notification payloads.
      }
    };
    return () => {
      socket.close();
    };
  }, [t, token]);

  async function handleBind() {
    if (!token) {
      router.replace("/login");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await apiRequest("/relationships/bind-by-invite", {
        method: "POST",
        token,
        body: { invite_code: inviteCode.trim() },
      });
      window.sessionStorage.removeItem(SKIP_BIND_KEY);
      setNotice(t("dashboard.binding_done"));
      router.replace("/dashboard");
    } catch (err) {
      setError(translateApiError(getErrorDetail(err), t));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreatePost() {
    if (!token || !postIntro.trim()) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      let uploadedImageUrl: string | null = null;
      if (postImageFile) {
        const formData = new FormData();
        formData.append("image_file", postImageFile);
        const uploadResponse = (await apiRequest("/match/posts/upload-image", {
          method: "POST",
          token,
          body: formData,
        })) as { image_url: string };
        uploadedImageUrl = uploadResponse.image_url;
      }
      const response = (await apiRequest("/match/posts", {
        method: "POST",
        token,
        body: { intro: postIntro.trim(), image_url: uploadedImageUrl },
      })) as { post: MatchPost };
      setMyPost(response.post);
      setPostIntro("");
      setPostImageFile(null);
      setShowComposer(false);
      await refreshMatchData(token);
    } catch (err) {
      setError(translateApiError(getErrorDetail(err), t));
    } finally {
      setBusy(false);
    }
  }

  async function handleClosePost() {
    if (!token || !myPost) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/match/posts/${encodeURIComponent(myPost.id)}/close`, {
        method: "POST",
        token,
      });
      setMyPost(null);
      await refreshMatchData(token);
    } catch (err) {
      setError(translateApiError(getErrorDetail(err), t));
    } finally {
      setBusy(false);
    }
  }

  async function handleSendRequest(postId: string) {
    if (!token) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/match/posts/${encodeURIComponent(postId)}/requests`, {
        method: "POST",
        token,
        body: { message: requestMessages[postId]?.trim() || null },
      });
      setRequestMessages((current) => ({ ...current, [postId]: "" }));
      await refreshMatchData(token);
    } catch (err) {
      setError(translateApiError(getErrorDetail(err), t));
    } finally {
      setBusy(false);
    }
  }

  async function handleInboxAction(requestId: string, action: "accept" | "reject") {
    if (!token) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/match/requests/${encodeURIComponent(requestId)}/${action}`, {
        method: "POST",
        token,
        body: { reason: null },
      });
      await refreshMatchData(token);
      const meResponse = (await apiRequest("/me", { token })) as MeResponse;
      if (meResponse.current_relationship) {
        router.replace("/dashboard");
      }
    } catch (err) {
      setError(translateApiError(getErrorDetail(err), t));
    } finally {
      setBusy(false);
    }
  }

  async function handleBlockUser(targetUserId: string) {
    if (!token) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await apiRequest("/match/blocks", {
        method: "POST",
        token,
        body: { target_user_id: targetUserId, reason: null },
      });
      await refreshMatchData(token);
    } catch (err) {
      setError(translateApiError(getErrorDetail(err), t));
    } finally {
      setBusy(false);
    }
  }

  async function handleReportUser(targetUserId: string, requestId?: string) {
    if (!token) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await apiRequest("/match/reports", {
        method: "POST",
        token,
        body: { target_user_id: targetUserId, request_id: requestId || null, reason: "inappropriate" },
      });
      await refreshMatchData(token);
    } catch (err) {
      setError(translateApiError(getErrorDetail(err), t));
    } finally {
      setBusy(false);
    }
  }

  async function handleSkip() {
    window.sessionStorage.setItem(SKIP_BIND_KEY, "1");
    router.replace("/dashboard");
  }

  async function handleSaveProfile() {
    if (!token) {
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
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
      })) as { user: UserSummary };
      const normalizedUser = normalizeUserSummary(response.user);
      setMe((current) => (current ? { ...current, user: normalizedUser } : current));
      const onboarding = readOnboarding();
      if (onboarding) {
        window.sessionStorage.setItem(
          ONBOARDING_KEY,
          JSON.stringify({
            ...onboarding,
            display_name: normalizedUser.display_name,
            gender: normalizedUser.gender,
            seeking_gender: normalizedUser.seeking_gender,
            sexual_orientation: normalizedUser.sexual_orientation,
            identity_labels: normalizedUser.identity_labels,
          }),
        );
      }
      setNotice(t("profile.save_done"));
    } catch (err) {
      setError(translateApiError(getErrorDetail(err), t));
    } finally {
      setBusy(false);
    }
  }

  if (!hydrated || !me) {
    return <LoadingState message={t("common.loading_dashboard")} />;
  }

  const sourceCopy =
    source === "register" ? t("bind.source_register") : source === "login" ? t("bind.source_login") : "";
  const isOwner = me.user.role_preference === "owner";
  const hasActivePost = myPost?.status === "active";

  const renderFeedStream = () => (
    <section className="bind-community-stream" aria-label={t("bind.community_feed")}>
      {posts.length === 0 ? (
        <div className="bind-empty-card">
          <span className="bind-empty-icon">🐾</span>
          <p className="bind-empty-title">{t("bind.community_feed_empty")}</p>
        </div>
      ) : (
        posts.map((post, index) => (
          <Card key={post.id} className="bind-feed-card" style={{ animationDelay: `${index * 40}ms` }}>
            <CardBody>
              <div className="bind-feed-author">
                <span className="bind-feed-avatar">{getInitialLetter(post.display_name)}</span>
                <div className="bind-feed-author-copy">
                  <strong>{post.display_name}</strong>
                  <span className="bind-feed-time">{formatDate(post.created_at, locale)}</span>
                </div>
                <Badge status="pending">{post.role_preference === "owner" ? `🔗 ${t("role.owner")}` : `🐾 ${t("role.puppy")}`}</Badge>
              </div>

              <p className="bind-feed-text">{post.intro}</p>
              <p className="bind-feed-time">
                {t("common.gender")}: {formatGenderLabel(post.gender || "private", t)} | {t("common.seeking_gender")}:{" "}
                {formatSeekingGenderLabel(post.seeking_gender || "any", t)}
              </p>
              <p className="bind-feed-time">
                {t("common.sexual_orientation")}: {formatOrientationLabel(post.sexual_orientation || "unspecified", t)}
              </p>
              {post.identity_labels && post.identity_labels.length > 0 ? (
                <p className="bind-feed-time">
                  {t("common.identity_labels")}: {post.identity_labels.map((label) => formatIdentityLabel(label, t)).join(", ")}
                </p>
              ) : null}
              {post.image_url ? (
                <img
                  src={toAssetUrl(post.image_url)}
                  alt={post.display_name || "match post"}
                  className="bind-feed-image"
                  loading="lazy"
                />
              ) : null}

              <FormField label={t("bind.match_message_placeholder")}>
                <Input
                  value={requestMessages[post.id] || ""}
                  onChange={(event) =>
                    setRequestMessages((current) => ({
                      ...current,
                      [post.id]: event.target.value,
                    }))
                  }
                  placeholder={t("bind.match_message_placeholder")}
                />
              </FormField>

              <ButtonGroup className="bind-feed-actions">
                <Button
                  type="button"
                  variant="primary"
                  role={isOwner ? "owner" : "puppy"}
                  onClick={() => void handleSendRequest(post.id)}
                  disabled={busy || dailySentCount >= 5 || Boolean(post.has_pending_request)}
                >
                  {t("bind.match_send_request")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleBlockUser(post.user_id)}
                  disabled={busy}
                >
                  {t("bind.match_block")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleReportUser(post.user_id)}
                  disabled={busy}
                >
                  {t("bind.match_report")}
                </Button>
              </ButtonGroup>
            </CardBody>
          </Card>
        ))
      )}
    </section>
  );

  const renderInboxStream = () => (
    <section className="bind-community-stream" aria-label={t("bind.community_inbox")}>
      {inbox.length === 0 ? (
        <div className="bind-empty-card">
          <span className="bind-empty-icon">📥</span>
          <p className="bind-empty-title">{t("bind.community_inbox_empty")}</p>
        </div>
      ) : (
        inbox.map((item) => (
          <Card key={item.id} className="bind-feed-card bind-feed-card-inbox">
            <CardBody>
              <div className="bind-feed-author">
                <span className="bind-feed-avatar">{getInitialLetter(item.requester_display_name)}</span>
                <div className="bind-feed-author-copy">
                  <strong>{item.requester_display_name}</strong>
                  <span className="bind-feed-time">{formatDate(item.created_at, locale)}</span>
                </div>
                <Badge status={toBadgeStatus(item.status)}>{getMatchRequestStatusLabel(item.status, t)}</Badge>
              </div>
              {item.message ? <p className="bind-feed-text">{item.message}</p> : null}
              {item.status === "pending" ? (
                <ButtonGroup className="bind-feed-actions">
                  <Button
                    type="button"
                    variant="primary"
                    role={isOwner ? "owner" : "puppy"}
                    onClick={() => void handleInboxAction(item.id, "accept")}
                    disabled={busy}
                  >
                    {t("bind.match_accept")}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void handleInboxAction(item.id, "reject")}
                    disabled={busy}
                  >
                    {t("bind.match_reject")}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void handleBlockUser(item.requester_id)}
                    disabled={busy}
                  >
                    {t("bind.match_block")}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void handleReportUser(item.requester_id, item.id)}
                    disabled={busy}
                  >
                    {t("bind.match_report")}
                  </Button>
                </ButtonGroup>
              ) : null}
            </CardBody>
          </Card>
        ))
      )}
    </section>
  );

  const renderMineStream = () => (
    <section className="bind-community-stream" aria-label={t("bind.community_mine")}>
      {hasActivePost ? (
        <Card className="bind-feed-card bind-feed-card-mine" role={isOwner ? "owner" : "puppy"}>
          <CardHeader>
            <h3>{t("bind.match_intro_label")}</h3>
          </CardHeader>
          <CardBody>
            <p className="bind-feed-text">{myPost?.intro}</p>
            {myPost?.image_url ? (
              <img
                src={toAssetUrl(myPost.image_url)}
                alt={t("bind.match_intro_label")}
                className="bind-feed-image"
                loading="lazy"
              />
            ) : null}
            {myPost ? <p className="bind-feed-time">{formatDate(myPost.created_at, locale)}</p> : null}
            <Button type="button" variant="secondary" onClick={() => void handleClosePost()} disabled={busy}>
              {t("bind.match_close_post")}
            </Button>
          </CardBody>
        </Card>
      ) : null}

      {sent.length === 0 && !hasActivePost ? (
        <div className="bind-empty-card">
          <span className="bind-empty-icon">🏷️</span>
          <p className="bind-empty-title">{t("bind.community_mine_empty")}</p>
        </div>
      ) : (
        sent.map((item) => (
          <Card key={item.id} className="bind-feed-card bind-feed-card-sent">
            <CardBody>
              <div className="bind-feed-author">
                <span className="bind-feed-avatar">{getInitialLetter(item.target_display_name)}</span>
                <div className="bind-feed-author-copy">
                  <strong>{item.target_display_name}</strong>
                  <span className="bind-feed-time">{formatDate(item.created_at, locale)}</span>
                </div>
                <Badge status={toBadgeStatus(item.status)}>{getMatchRequestStatusLabel(item.status, t)}</Badge>
              </div>
              {item.reject_reason_code ? (
                <p className="bind-feed-text">{translateApiError({ code: item.reject_reason_code }, t)}</p>
              ) : null}
            </CardBody>
          </Card>
        ))
      )}
    </section>
  );

  return (
    <div className="bind-page">
      <header className="bind-header">
        <div className="bind-header-bar">
          <div>
            <h1 className="bind-title">
              {isOwner ? "🔗\u00a0" : "🐾\u00a0"}
              <em>{t("bind.title")}</em>
            </h1>
            <p className="bind-subtitle">{t("bind.description")}</p>
          </div>
          <LanguageSwitcher id="bind-language" />
        </div>
      </header>

      <main className="bind-main">
        {sourceCopy ? (
          <div className="bind-source-banner">{sourceCopy}</div>
        ) : null}

        {error ? (
          <div style={{ marginBottom: "16px" }}>
            <ErrorState title={t("common.request_failed")} description={error} />
          </div>
        ) : null}

        {notice ? (
          <div className="bind-notice">{notice}</div>
        ) : null}

        <div className="bind-tabs">
          <button
            type="button"
            className={`btn-tab${activeTab === "match" ? " is-active" : ""}`}
            onClick={() => setActiveTab("match")}
          >
            {isOwner ? "🔗 " : "🐾 "}{t("bind.tab_match")}
          </button>
          <button
            type="button"
            className={`btn-tab${activeTab === "profile" ? " is-active" : ""}`}
            onClick={() => setActiveTab("profile")}
          >
            👤 {t("bind.tab_profile")}
          </button>
          <button
            type="button"
            className={`btn-tab${activeTab === "invite" ? " is-active" : ""}`}
            onClick={() => setActiveTab("invite")}
          >
            🏷️{t("bind.tab_invite")}
          </button>
        </div>

        {activeTab === "match" ? (
          <>
            <div className="bind-community-head">
              <div className="bind-community-head-inner" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", padding: "18px 20px", flexWrap: "wrap" }}>
                <div className="bind-community-profile">
                  <div className="bind-community-avatar">
                    {isOwner ? "👤" : getInitialLetter(me.user.display_name)}
                  </div>
                  <div>
                    <p className="bind-community-name">{me.user.display_name}</p>
                    <p className="bind-community-role">
                      {isOwner ? `🔗 ${t("role.owner")}` : `🐾 ${t("role.puppy")}`}
                    </p>
                  </div>
                </div>
                <div className="bind-community-stats">
                  <div className="bind-community-pill">
                    <span>📬 {t("bind.match_pending_count")}</span>
                    <strong>{pendingCount}</strong>
                  </div>
                  <div className="bind-community-pill">
                    <span>💌 {t("bind.match_daily_usage")}</span>
                    <strong>{dailySentCount}/5</strong>
                  </div>
                </div>
              </div>
            </div>

            <nav className="bind-community-nav" aria-label={t("bind.tab_match")}>
              <button
                type="button"
                className={`bind-community-nav-item${activeMatchView === "feed" ? " is-active" : ""}`}
                onClick={() => setActiveMatchView("feed")}
              >
                <span className="bind-community-nav-icon" aria-hidden="true">🐾</span>
                <span className="bind-community-nav-label">{t("bind.community_feed")}</span>
              </button>
              <button
                type="button"
                className={`bind-community-nav-item${activeMatchView === "inbox" ? " is-active" : ""}`}
                onClick={() => setActiveMatchView("inbox")}
              >
                <span className="bind-community-nav-icon" aria-hidden="true">📬</span>
                <span className="bind-community-nav-label">{t("bind.community_inbox")}</span>
                {pendingCount > 0 ? <span className="bind-community-nav-count">{pendingCount}</span> : null}
              </button>
              <button
                type="button"
                className={`bind-community-nav-item${activeMatchView === "mine" ? " is-active" : ""}`}
                onClick={() => setActiveMatchView("mine")}
              >
                <span className="bind-community-nav-icon" aria-hidden="true">🏷️</span>
                <span className="bind-community-nav-label">{t("bind.community_mine")}</span>
              </button>
            </nav>

            <div className="bind-community-stage">
              {activeMatchView === "feed" ? renderFeedStream() : null}
              {activeMatchView === "inbox" ? renderInboxStream() : null}
              {activeMatchView === "mine" ? renderMineStream() : null}
            </div>

            <button
              type="button"
              className="bind-fab"
              onClick={() => setShowComposer(true)}
              disabled={busy || hasActivePost}
              aria-label={t("bind.community_publish_post")}
              title={hasActivePost ? t("bind.match_close_post") : t("bind.community_publish_post")}
            >
              🐾
            </button>

            {showComposer ? (
              <div
                className="bind-composer-backdrop"
                role="dialog"
                aria-modal="true"
                aria-labelledby="bind-composer-title"
                onClick={() => {
                  setShowComposer(false);
                  setPostImageFile(null);
                }}
              >
                <div className="bind-composer" onClick={(event) => event.stopPropagation()}>
                  <h3 id="bind-composer-title">{t("bind.community_publish_title")}</h3>
                  <p>{t("bind.community_publish_hint")}</p>
                  <FormField label={t("bind.match_intro_label")}>
                    <textarea
                      value={postIntro}
                      onChange={(event) => setPostIntro(event.target.value)}
                      placeholder={t("bind.match_intro_placeholder")}
                      rows={4}
                    />
                  </FormField>
                  <FormField label={t("bind.match_pick_image")}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => setPostImageFile(event.target.files?.[0] || null)}
                    />
                  </FormField>
                  {postImagePreviewUrl ? (
                    <img src={postImagePreviewUrl} alt={t("bind.match_pick_image")} className="bind-composer-preview" />
                  ) : null}
                  <ButtonGroup>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setShowComposer(false);
                        setPostImageFile(null);
                      }}
                    >
                      {t("common.cancel")}
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      role={isOwner ? "owner" : "puppy"}
                      onClick={() => void handleCreatePost()}
                      disabled={busy || !postIntro.trim()}
                    >
                      {t("bind.match_create_post")}
                    </Button>
                  </ButtonGroup>
                </div>
              </div>
            ) : null}
          </>
        ) : activeTab === "profile" ? (
          <div className="bind-shell">
            <Card>
              <CardHeader>
                <h2 style={{ margin: 0 }}>{t("bind.account_summary")}</h2>
              </CardHeader>
              <CardBody>
                <div className="dashboard-info-grid">
                  <div className="dashboard-info-row">
                    <p className="dashboard-info-label">{t("common.display_name")}</p>
                    <p className="dashboard-info-value">{me.user.display_name}</p>
                  </div>
                  <div className="dashboard-info-row">
                    <p className="dashboard-info-label">{t("common.email")}</p>
                    <p className="dashboard-info-value">{me.user.email}</p>
                  </div>
                  <div className="dashboard-info-row">
                    <p className="dashboard-info-label">{t("common.role_preference")}</p>
                    <p className="dashboard-info-value">
                      {me.user.role_preference === "owner" ? t("role.owner") : t("role.puppy")}
                    </p>
                  </div>
                  <div className="dashboard-info-row">
                    <p className="dashboard-info-label">{t("common.gender")}</p>
                    <p className="dashboard-info-value">{formatGenderLabel(me.user.gender, t)}</p>
                  </div>
                  <div className="dashboard-info-row">
                    <p className="dashboard-info-label">{t("common.seeking_gender")}</p>
                    <p className="dashboard-info-value">{formatSeekingGenderLabel(me.user.seeking_gender, t)}</p>
                  </div>
                  <div className="dashboard-info-row">
                    <p className="dashboard-info-label">{t("common.sexual_orientation")}</p>
                    <p className="dashboard-info-value">{formatOrientationLabel(me.user.sexual_orientation, t)}</p>
                  </div>
                  <div className="dashboard-info-row">
                    <p className="dashboard-info-label">{t("common.identity_labels")}</p>
                    <p className="dashboard-info-value">
                      {(me.user.identity_labels || []).length > 0
                        ? me.user.identity_labels.map((label) => formatIdentityLabel(label, t)).join(", ")
                        : "-"}
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>

            <div className="bind-stack">
              <Card role={isOwner ? "owner" : "puppy"}>
                <CardHeader>
                  <h2 style={{ margin: 0 }}>{t("dashboard.nav.profile")}</h2>
                </CardHeader>
                <CardBody>
                  <FormField label={t("common.display_name")} required>
                    <Input
                      value={profileForm.display_name}
                      onChange={(event) => setProfileForm((current) => ({ ...current, display_name: event.target.value }))}
                    />
                  </FormField>
                  <FormField label={t("common.gender")} required>
                    <Select
                      value={profileForm.gender}
                      onChange={(event) =>
                        setProfileForm((current) => ({ ...current, gender: event.target.value as UserSummary["gender"] }))
                      }
                      options={[
                        { value: "male", label: t("gender.male") },
                        { value: "female", label: t("gender.female") },
                        { value: "trans", label: t("gender.trans") },
                        { value: "non_binary", label: t("gender.non_binary") },
                        { value: "private", label: t("gender.private") },
                      ]}
                    />
                  </FormField>
                  <FormField label={t("common.seeking_gender")} required>
                    <Select
                      value={profileForm.seeking_gender}
                      onChange={(event) =>
                        setProfileForm((current) => ({
                          ...current,
                          seeking_gender: event.target.value as UserSummary["seeking_gender"],
                        }))
                      }
                      options={[
                        { value: "any", label: t("seeking_gender.any") },
                        { value: "male", label: t("gender.male") },
                        { value: "female", label: t("gender.female") },
                        { value: "trans", label: t("gender.trans") },
                        { value: "non_binary", label: t("gender.non_binary") },
                      ]}
                    />
                  </FormField>
                  <FormField label={t("common.sexual_orientation")} required>
                    <Select
                      value={profileForm.sexual_orientation}
                      onChange={(event) =>
                        setProfileForm((current) => ({
                          ...current,
                          sexual_orientation: event.target.value as UserSummary["sexual_orientation"],
                        }))
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
                  </FormField>
                  <FormField label={`${t("common.identity_labels")}（可不选）`}>
                    <div className="identity-chip-group" role="group" aria-label={t("common.identity_labels")}>
                      {(["lesbian", "gay", "femboy", "ts", "cd", "4i"] as const).map((label) => (
                        <button
                          key={label}
                          type="button"
                          className={`identity-chip${profileForm.identity_labels.includes(label) ? " is-active" : ""}`}
                          aria-pressed={profileForm.identity_labels.includes(label)}
                          onClick={() =>
                            setProfileForm((current) => ({
                              ...current,
                              identity_labels: toggleIdentityLabel(current.identity_labels, label),
                            }))
                          }
                        >
                          {formatIdentityLabel(label, t)}
                        </button>
                      ))}
                    </div>
                  </FormField>
                  <Button
                    type="button"
                    variant="primary"
                    role={isOwner ? "owner" : "puppy"}
                    onClick={() => void handleSaveProfile()}
                    disabled={busy || !profileForm.display_name.trim()}
                  >
                    {busy ? t("profile.saving") : t("profile.save")}
                  </Button>
                </CardBody>
              </Card>
            </div>
          </div>
        ) : (
          <div className="bind-shell">
            <Card role={isOwner ? "owner" : "puppy"}>
              <CardHeader>
                <h2 style={{ margin: 0 }}>{t("bind.my_invite_code")}</h2>
              </CardHeader>
              <CardBody>
                <div className="bind-code">
                  <p className="bind-code-value">{me.user.invite_code}</p>
                </div>
                <p style={{ marginTop: "var(--space-4)", color: "var(--muted)" }}>
                  {isOwner ? t("bind.owner_waiting_hint") : t("bind.puppy_waiting_hint")}
                </p>
              </CardBody>
            </Card>

            <Card role={isOwner ? "owner" : "puppy"}>
              <CardHeader>
                <h2 style={{ margin: 0 }}>{t("bind.enter_counterpart_code")}</h2>
              </CardHeader>
              <CardBody>
                <p style={{ marginTop: 0, marginBottom: "var(--space-4)", color: "var(--muted)" }}>
                  {t("bind.counterpart_code_hint")}
                </p>
                <FormField label={t("dashboard.invite_code")}>
                  <Input
                    value={inviteCode}
                    onChange={(event) => setInviteCode(event.target.value)}
                    placeholder={t("dashboard.invite_code_placeholder")}
                  />
                </FormField>
                <ButtonGroup>
                  <Button
                    type="button"
                    variant="primary"
                    role={isOwner ? "owner" : "puppy"}
                    onClick={() => void handleBind()}
                    disabled={busy || !inviteCode.trim()}
                  >
                    {busy ? t("dashboard.binding") : t("dashboard.bind_by_invite")}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => void handleSkip()}>
                    {t("bind.skip_to_dashboard")}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      window.sessionStorage.setItem(SKIP_BIND_KEY, "1");
                      router.replace("/dashboard");
                    }}
                  >
                    {t("bind.open_dashboard")}
                  </Button>
                </ButtonGroup>
              </CardBody>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}


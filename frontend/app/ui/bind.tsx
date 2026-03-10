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
import { FormField, Input } from "./FormField";
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
  status: "active" | "closed" | "matched";
  created_at: string;
  display_name?: string;
  has_pending_request?: boolean;
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
  if (body !== undefined) {
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
    body: body === undefined ? undefined : JSON.stringify(body),
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
  const [activeTab, setActiveTab] = useState<"match" | "invite">(tab === "invite" ? "invite" : "match");
  const [activeMatchView, setActiveMatchView] = useState<MatchCommunityView>("feed");
  const [showComposer, setShowComposer] = useState(false);
  const [myPost, setMyPost] = useState<MatchPost | null>(null);
  const [postIntro, setPostIntro] = useState("");
  const [posts, setPosts] = useState<MatchPost[]>([]);
  const [inbox, setInbox] = useState<MatchRequestInboxItem[]>([]);
  const [sent, setSent] = useState<MatchRequestSentItem[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [requestMessages, setRequestMessages] = useState<Record<string, string>>({});

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
        user: onboarding as UserSummary,
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
        setMe(response);
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

  async function refreshMatchData(currentToken: string) {
    const [postsResponse, inboxResponse, sentResponse] = await Promise.all([
      apiRequest("/match/posts", { token: currentToken }) as Promise<{ posts: MatchPost[] }>,
      apiRequest("/match/requests/inbox", { token: currentToken }) as Promise<{
        requests: MatchRequestInboxItem[];
        pending_count: number;
      }>,
      apiRequest("/match/requests/sent", { token: currentToken }) as Promise<{ requests: MatchRequestSentItem[] }>,
    ]);
    setPosts(postsResponse.posts || []);
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
      const response = (await apiRequest("/match/posts", {
        method: "POST",
        token,
        body: { intro: postIntro.trim() },
      })) as { post: MatchPost };
      setMyPost(response.post);
      setPostIntro("");
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
        <Card className="bind-empty-card">
          <CardBody>
            <p className="bind-empty-title">{t("bind.community_feed_empty")}</p>
          </CardBody>
        </Card>
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
                <Badge status="pending">{post.role_preference === "owner" ? t("role.owner") : t("role.puppy")}</Badge>
              </div>

              <p className="bind-feed-text">{post.intro}</p>

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
        <Card className="bind-empty-card">
          <CardBody>
            <p className="bind-empty-title">{t("bind.community_inbox_empty")}</p>
          </CardBody>
        </Card>
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
            {myPost ? <p className="bind-feed-time">{formatDate(myPost.created_at, locale)}</p> : null}
            <Button type="button" variant="secondary" onClick={() => void handleClosePost()} disabled={busy}>
              {t("bind.match_close_post")}
            </Button>
          </CardBody>
        </Card>
      ) : null}

      {sent.length === 0 && !hasActivePost ? (
        <Card className="bind-empty-card">
          <CardBody>
            <p className="bind-empty-title">{t("bind.community_mine_empty")}</p>
          </CardBody>
        </Card>
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
        <div className="container bind-header-bar wrap-on-mobile">
          <div>
            <h1 className="bind-title">{t("bind.title")}</h1>
            <p className="bind-subtitle">{t("bind.description")}</p>
          </div>
          <LanguageSwitcher id="bind-language" />
        </div>
      </header>

      <main className="container bind-main">
        {sourceCopy ? (
          <Card style={{ marginBottom: "var(--space-6)" }}>
            <p className="bind-source">{sourceCopy}</p>
          </Card>
        ) : null}

        {error ? (
          <div style={{ marginBottom: "var(--space-6)" }}>
            <ErrorState title={t("common.request_failed")} description={error} />
          </div>
        ) : null}

        {notice ? (
          <div style={{ marginBottom: "var(--space-6)" }}>
            <Card>
              <p style={{ margin: 0 }}>{notice}</p>
            </Card>
          </div>
        ) : null}

        <div className="bind-tabs">
          <Button
            type="button"
            variant={activeTab === "match" ? "primary" : "secondary"}
            role={isOwner ? "owner" : "puppy"}
            onClick={() => setActiveTab("match")}
          >
            {t("bind.tab_match")}
          </Button>
          <Button
            type="button"
            variant={activeTab === "invite" ? "primary" : "secondary"}
            onClick={() => setActiveTab("invite")}
          >
            {t("bind.tab_invite")}
          </Button>
        </div>

        {activeTab === "match" ? (
          <>
            <Card className="bind-community-head">
              <CardBody>
                <div className="bind-community-profile">
                  <div className="bind-community-avatar">{getInitialLetter(me.user.display_name)}</div>
                  <div>
                    <p className="bind-community-name">{me.user.display_name}</p>
                    <p className="bind-community-role">
                      {me.user.role_preference === "owner" ? t("role.owner") : t("role.puppy")}
                    </p>
                  </div>
                </div>
                <div className="bind-community-stats">
                  <div className="bind-community-pill">
                    <span>{t("bind.match_pending_count")}</span>
                    <strong>{pendingCount}</strong>
                  </div>
                  <div className="bind-community-pill">
                    <span>{t("bind.match_daily_usage")}</span>
                    <strong>{dailySentCount}/5</strong>
                  </div>
                </div>
              </CardBody>
            </Card>

            <nav className="bind-community-nav" aria-label={t("bind.tab_match")}>
              <button
                type="button"
                className={`bind-community-nav-item${activeMatchView === "feed" ? " is-active" : ""}`}
                onClick={() => setActiveMatchView("feed")}
              >
                {t("bind.community_feed")}
              </button>
              <button
                type="button"
                className={`bind-community-nav-item${activeMatchView === "inbox" ? " is-active" : ""}`}
                onClick={() => setActiveMatchView("inbox")}
              >
                {t("bind.community_inbox")}
                {pendingCount > 0 ? <span className="bind-community-nav-count">{pendingCount}</span> : null}
              </button>
              <button
                type="button"
                className={`bind-community-nav-item${activeMatchView === "mine" ? " is-active" : ""}`}
                onClick={() => setActiveMatchView("mine")}
              >
                {t("bind.community_mine")}
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
              +
            </button>

            {showComposer ? (
              <div
                className="bind-composer-backdrop"
                role="dialog"
                aria-modal="true"
                aria-labelledby="bind-composer-title"
                onClick={() => setShowComposer(false)}
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
                  <ButtonGroup>
                    <Button type="button" variant="secondary" onClick={() => setShowComposer(false)}>
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
        ) : (
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
                </div>
              </CardBody>
            </Card>

            <div className="bind-stack">
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
          </div>
        )}
      </main>
    </div>
  );
}

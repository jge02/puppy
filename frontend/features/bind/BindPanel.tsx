"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import type { Locale } from "../../lib/i18n/config";
import type { MessageKey } from "../../lib/i18n/messages";
import { translateApiError } from "../../lib/i18n/api-errors";
import { useI18n } from "../../lib/i18n/useI18n";
import { Badge } from "../../components/Badge";
import { Button, ButtonGroup } from "../../components/Button";
import { Card, CardBody, CardHeader } from "../../components/Card";
import { ErrorState } from "../../components/ErrorState";
import { FormField, Input, Select } from "../../components/FormField";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { LoadingState } from "../../components/LoadingState";
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

type OnboardingSession = Partial<UserSummary> & {
  profile_completed?: boolean;
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

function readOnboarding(): OnboardingSession | null {
  try {
    const raw = window.sessionStorage.getItem(ONBOARDING_KEY);
    return raw ? (JSON.parse(raw) as OnboardingSession) : null;
  } catch {
    return null;
  }
}

function getBindOnboardingCopy(locale: Locale) {
  if (locale === "en") {
    return {
      registerSource: "Your account is ready. Complete your profile first, then continue into binding and matching.",
      registerNotice: "Profile step one is open. Add the details that make you easier to understand and easier to choose.",
      profileTitle: "Complete your profile",
      profileHint: "A fuller profile gives both sides a better first impression before matching starts.",
    };
  }
  if (locale === "fr") {
    return {
      registerSource: "Votre compte est pret. Completez d'abord votre profil, puis continuez vers la liaison et le matching.",
      registerNotice: "La premiere etape du profil est ouverte. Ajoutez les details qui vous presentent avec plus de clarte.",
      profileTitle: "Completez votre profil",
      profileHint: "Un profil plus complet donne une meilleure premiere impression avant le matching.",
    };
  }
  if (locale === "zh-TW") {
    return {
      registerSource: "帳號已建立。先把資料補完整，再進入綁定與匹配。",
      registerNotice: "資料完善的第一步已經打開。先把自己寫清楚，再去遇見對的人。",
      profileTitle: "先把資料補完整",
      profileHint: "更完整的資料，會讓彼此在進入匹配前都得到更好的第一印象。",
    };
  }
  return {
    registerSource: "账号已建立。先把资料补完整，再进入绑定与匹配。",
    registerNotice: "资料完善的第一步已经打开。先把自己写清楚，再去遇见对的人。",
    profileTitle: "先把资料补完整",
    profileHint: "更完整的资料，会让彼此在进入匹配前都得到更好的第一印象。",
  };
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
  mode?: "default" | "swipe";
};

export default function BindPanel({ source, tab, mode = "default" }: BindPanelProps) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const onboardingCopy = getBindOnboardingCopy(locale);
  const [token, setToken] = useState("");
  const [me, setMe] = useState<MeResponse | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState<"match" | "invite" | "profile">(
    mode === "swipe" ? "match" : tab === "invite" ? "invite" : "profile"
  );
  const [showComposer, setShowComposer] = useState(false);
  const [pendingInvitePost, setPendingInvitePost] = useState<MatchPost | null>(null);
  const [myPost, setMyPost] = useState<MatchPost | null>(null);
  const [postIntro, setPostIntro] = useState("");
  const [postImageFile, setPostImageFile] = useState<File | null>(null);
  const [postImagePreviewUrl, setPostImagePreviewUrl] = useState<string | null>(null);
  const [posts, setPosts] = useState<MatchPost[]>([]);
  const [inbox, setInbox] = useState<MatchRequestInboxItem[]>([]);
  const [sent, setSent] = useState<MatchRequestSentItem[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [requestMessages, setRequestMessages] = useState<Record<string, string>>({});
  const [swipedPostIds, setSwipedPostIds] = useState<string[]>([]);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [draggingPostId, setDraggingPostId] = useState<string | null>(null);
  const [exitingPostId, setExitingPostId] = useState<string | null>(null);
  const [exitDirection, setExitDirection] = useState<"left" | "right" | null>(null);
  const dragStartXRef = useRef<number | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
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
      if (source === "register" && onboarding.profile_completed === false) {
        setNotice(onboardingCopy.registerNotice);
      }
    }
    setHydrated(true);
  }, [onboardingCopy.registerNotice, router, source]);

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
  const bindStageTitle =
    activeTab === "profile"
      ? source === "register"
        ? onboardingCopy.profileTitle
        : t("dashboard.nav.profile")
      : t("bind.enter_counterpart_code");
  const bindStageHint =
    activeTab === "profile"
      ? source === "register"
        ? onboardingCopy.profileHint
        : t("bind.description")
      : t("bind.counterpart_code_hint");

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
    setSwipedPostIds((current) => current.filter((id) => posts.some((post) => post.id === id)));
  }, [posts]);

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
    socket.onmessage = (event: MessageEvent) => {
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
      return false;
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
      return true;
    } catch (err) {
      setError(translateApiError(getErrorDetail(err), t));
      return false;
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
            profile_completed: true,
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
    source === "register" ? onboardingCopy.registerSource : source === "login" ? t("bind.source_login") : "";
  const isOwner = me.user.role_preference === "owner";
  const hasActivePost = myPost?.status === "active";
  const totalSwipePosts = posts.length;
  const swipeablePosts = posts.filter((post) => !swipedPostIds.includes(post.id));
  const currentSwipePost = swipeablePosts[0] || null;
  const nextSwipePost = swipeablePosts[1] || null;
  const swipeProgress = Math.min(Math.abs(dragOffsetX) / 150, 1);
  const swipeProgressCount = totalSwipePosts - swipeablePosts.length;
  const swipeProgressRatio = totalSwipePosts > 0 ? swipeProgressCount / totalSwipePosts : 0;
  const swipeHint =
    locale === "en"
      ? "Swipe left to pass, swipe right to invite"
      : locale === "fr"
      ? "Glissez a gauche pour passer, a droite pour inviter"
      : "左滑跳过，右滑邀请";

  function resetSwipeState() {
    setDragOffsetX(0);
    setDraggingPostId(null);
    setExitingPostId(null);
    setExitDirection(null);
    dragStartXRef.current = null;
    activePointerIdRef.current = null;
  }

  function markPostSwiped(postId: string) {
    setSwipedPostIds((current) => (current.includes(postId) ? current : [...current, postId]));
    resetSwipeState();
  }

  function openInviteComposer(post: MatchPost) {
    setPendingInvitePost(post);
    setDragOffsetX(0);
    setDraggingPostId(null);
    setExitingPostId(null);
    setExitDirection(null);
    dragStartXRef.current = null;
    activePointerIdRef.current = null;
  }

  function triggerSwipe(post: MatchPost, direction: "left" | "right") {
    if (busy) {
      return;
    }
    if (direction === "right") {
      openInviteComposer(post);
      return;
    }
    setDraggingPostId(null);
    setExitingPostId(post.id);
    setExitDirection(direction);
    setDragOffsetX(-180);
    window.setTimeout(() => {
      markPostSwiped(post.id);
    }, 180);
  }

  function handleSwipePointerDown(event: React.PointerEvent<HTMLDivElement>, postId: string) {
    if (busy) {
      return;
    }
    dragStartXRef.current = event.clientX;
    activePointerIdRef.current = event.pointerId;
    setDraggingPostId(postId);
    setExitingPostId(null);
    setExitDirection(null);
    setDragOffsetX(0);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleSwipePointerMove(event: React.PointerEvent<HTMLDivElement>, postId: string) {
    if (draggingPostId !== postId || activePointerIdRef.current !== event.pointerId || dragStartXRef.current === null) {
      return;
    }
    const nextOffset = event.clientX - dragStartXRef.current;
    setDragOffsetX(Math.max(-180, Math.min(180, nextOffset)));
  }

  function handleSwipePointerUp(event: React.PointerEvent<HTMLDivElement>, post: MatchPost) {
    if (activePointerIdRef.current !== event.pointerId) {
      return;
    }
    if (dragOffsetX >= 120) {
      triggerSwipe(post, "right");
      return;
    }
    if (dragOffsetX <= -120) {
      triggerSwipe(post, "left");
      return;
    }
    resetSwipeState();
  }

  async function handleConfirmInvite() {
    if (!pendingInvitePost) {
      return;
    }
    const postId = pendingInvitePost.id;
    const sent = await handleSendRequest(postId);
    if (!sent) {
      return;
    }
    markPostSwiped(postId);
    setPendingInvitePost(null);
  }

  const renderFeedStream = () => (
    <section className="bind-community-stream" aria-label={t("bind.community_feed")}>
      {currentSwipePost === null ? (
        <div className="bind-empty-card">
          <span className="bind-empty-icon">🐾</span>
          <p className="bind-empty-title">{t("bind.community_feed_empty")}</p>
        </div>
      ) : (
        <div className="bind-swipe-stage">
          {nextSwipePost ? (
            <Card
              className="bind-feed-card bind-swipe-card bind-swipe-card-next"
              style={{
                transform: `translateY(${16 - swipeProgress * 8}px) scale(${0.97 + swipeProgress * 0.03})`,
                opacity: 0.72 + swipeProgress * 0.18,
              }}
            >
              <CardBody>
                <div className="bind-feed-author">
                  <span className="bind-feed-avatar">{getInitialLetter(nextSwipePost.display_name)}</span>
                  <div className="bind-feed-author-copy">
                    <strong>{nextSwipePost.display_name}</strong>
                    <span className="bind-feed-time">{formatDate(nextSwipePost.created_at, locale)}</span>
                  </div>
                  <Badge status="pending">{nextSwipePost.role_preference === "owner" ? `🔗 ${t("role.owner")}` : `🐾 ${t("role.puppy")}`}</Badge>
                </div>
                <p className="bind-feed-text bind-swipe-preview-text">{nextSwipePost.intro}</p>
              </CardBody>
            </Card>
          ) : null}

          <Card
            key={currentSwipePost.id}
            className={`bind-feed-card bind-swipe-card${
              draggingPostId === currentSwipePost.id ? " is-dragging" : ""
            }${exitingPostId === currentSwipePost.id && exitDirection === "left" ? " is-exit-left" : ""}${
              exitingPostId === currentSwipePost.id && exitDirection === "right" ? " is-exit-right" : ""
            }`}
            style={{
              transform:
                draggingPostId === currentSwipePost.id || exitingPostId === currentSwipePost.id
                  ? `translateX(${dragOffsetX}px) rotate(${dragOffsetX / 18}deg)`
                  : `translateY(${swipeProgress * -2}px)`,
            }}
            onPointerDown={(event) => handleSwipePointerDown(event, currentSwipePost.id)}
            onPointerMove={(event) => handleSwipePointerMove(event, currentSwipePost.id)}
            onPointerUp={(event) => handleSwipePointerUp(event, currentSwipePost)}
            onPointerCancel={resetSwipeState}
          >
            <CardBody className="bind-swipe-card-body">
              <div className="bind-swipe-card-scroll">
                <div className="bind-swipe-badge-row" aria-hidden="true">
                  <span
                    className={`bind-swipe-badge is-left${dragOffsetX <= -24 ? " is-visible" : ""}`}
                    style={{ opacity: dragOffsetX < 0 ? Math.min(Math.abs(dragOffsetX) / 120, 1) : undefined }}
                  >
                    NOPE
                  </span>
                  <span
                    className={`bind-swipe-badge is-right${dragOffsetX >= 24 ? " is-visible" : ""}`}
                    style={{ opacity: dragOffsetX > 0 ? Math.min(Math.abs(dragOffsetX) / 120, 1) : undefined }}
                  >
                    LIKE
                  </span>
                </div>

                <div className="bind-feed-author">
                  <span className="bind-feed-avatar">{getInitialLetter(currentSwipePost.display_name)}</span>
                  <div className="bind-feed-author-copy">
                    <strong>{currentSwipePost.display_name}</strong>
                    <span className="bind-feed-time">{formatDate(currentSwipePost.created_at, locale)}</span>
                  </div>
                  <Badge status="pending">{currentSwipePost.role_preference === "owner" ? `🔗 ${t("role.owner")}` : `🐾 ${t("role.puppy")}`}</Badge>
                </div>

                <p className="bind-feed-text">{currentSwipePost.intro}</p>
                <div className="bind-profile-chips">
                  <span className="bind-profile-chip">
                    {formatGenderLabel(currentSwipePost.gender || "private", t)}
                  </span>
                  <span className="bind-profile-chip bind-profile-chip-arrow">→</span>
                  <span className="bind-profile-chip">
                    {formatSeekingGenderLabel(currentSwipePost.seeking_gender || "any", t)}
                  </span>
                  <span className="bind-profile-chip">
                    {formatOrientationLabel(currentSwipePost.sexual_orientation || "unspecified", t)}
                  </span>
                  {currentSwipePost.identity_labels?.map((label) => (
                    <span key={label} className="bind-profile-chip bind-profile-chip-label">
                      {formatIdentityLabel(label, t)}
                    </span>
                  ))}
                </div>
                {currentSwipePost.image_url ? (
                  <img
                    src={toAssetUrl(currentSwipePost.image_url)}
                    alt={currentSwipePost.display_name || "match post"}
                    className="bind-feed-image"
                    loading="lazy"
                  />
                ) : null}
              </div>

              <div className="bind-swipe-card-footer">
                <ButtonGroup className="bind-feed-actions bind-swipe-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    className="bind-swipe-action-button is-pass"
                    onClick={() => triggerSwipe(currentSwipePost, "left")}
                    disabled={busy}
                  >
                    <span aria-hidden="true">✕</span>
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    role={isOwner ? "owner" : "puppy"}
                    className="bind-swipe-action-button is-like"
                    onClick={() => triggerSwipe(currentSwipePost, "right")}
                    disabled={busy || dailySentCount >= 5 || Boolean(currentSwipePost.has_pending_request)}
                  >
                    <span aria-hidden="true">♥</span>
                  </Button>
                </ButtonGroup>
                <div className="bind-swipe-secondary-actions">
                  <button
                    type="button"
                    className="bind-swipe-secondary-link"
                    onClick={() => void handleBlockUser(currentSwipePost.user_id)}
                    disabled={busy}
                  >
                    {t("bind.match_block")}
                  </button>
                  <span className="bind-swipe-secondary-dot" aria-hidden="true">•</span>
                  <button
                    type="button"
                    className="bind-swipe-secondary-link"
                    onClick={() => void handleReportUser(currentSwipePost.user_id)}
                    disabled={busy}
                  >
                    {t("bind.match_report")}
                  </button>
                </div>
              </div>
            </CardBody>
          </Card>

          <div className="bind-swipe-hint" aria-live="polite">
            <span className="bind-swipe-hint-icon is-left">←</span>
            <span>{swipeHint}</span>
            <span className="bind-swipe-hint-icon is-right">→</span>
          </div>
        </div>
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
    <div className={`bind-page${mode === "swipe" ? " bind-page-swipe" : ""}`}>
      {mode === "swipe" ? (
        <header className="bind-swipe-header">
          <div className="bind-swipe-header-bar">
            <button type="button" className="bind-swipe-back" onClick={() => router.replace("/dashboard")}>
              <span aria-hidden="true">←</span>
            </button>
            <div className="bind-swipe-header-copy">
              <p className="bind-swipe-kicker">{t("bind.tab_match")}</p>
              <h1 className="bind-swipe-title">{locale === "en" ? "Swipe" : locale === "fr" ? "Swipe" : "滑卡匹配"}</h1>
            </div>
            <LanguageSwitcher id="swipe-language" />
          </div>
          <div className="bind-swipe-progress-shell">
            <div className="bind-swipe-progress-copy">
              <span>{locale === "en" ? "Seen" : locale === "fr" ? "Vus" : "已看"}</span>
              <strong>{swipeProgressCount}/{totalSwipePosts || 0}</strong>
            </div>
            <div className="bind-swipe-progress-track" aria-hidden="true">
              <span className="bind-swipe-progress-bar" style={{ width: `${swipeProgressRatio * 100}%` }} />
            </div>
          </div>
        </header>
      ) : (
        <header className="bind-header">
          <div className="bind-header-bar">
            <div className="bind-header-copy">
              <p className="bind-header-kicker">{source === "register" ? "Profile flow" : "Binding flow"}</p>
              <h1 className="bind-title">
                {isOwner ? "🔗\u00a0" : "🐾\u00a0"}
                <em>{t("bind.title")}</em>
              </h1>
              <p className="bind-subtitle">{t("bind.description")}</p>
            </div>
            <LanguageSwitcher id="bind-language" />
          </div>
        </header>
      )}

      <main className={`bind-main${mode === "swipe" ? " bind-main-swipe" : ""}`}>
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

        {mode === "default" ? (
        <section className="bind-stage-panel">
          <div className="bind-stage-copy">
            <p className="bind-stage-kicker">{activeTab === "profile" ? "Step 1" : "Step 2"}</p>
            <h2 className="bind-stage-title">{bindStageTitle}</h2>
            <p className="bind-stage-text">{bindStageHint}</p>
          </div>
          <button
            type="button"
            className="bind-swipe-entry-card"
            onClick={() => router.replace("/match/swipe")}
          >
            <span className="bind-swipe-entry-badge">Swipe</span>
            <span className="bind-swipe-entry-copy">
              <strong>{t("dashboard.open_match_plaza")}</strong>
              <small>
                {locale === "en"
                  ? "Browse the mobile card stream instead of waiting."
                  : locale === "fr"
                  ? "Parcourez le flux de cartes mobile au lieu d'attendre."
                  : "直接进入滑卡广场，不用只等邀请码。"}
              </small>
            </span>
            <span className="bind-swipe-entry-arrow" aria-hidden="true">→</span>
          </button>
        </section>
        ) : null}

        {mode === "default" ? (
        <div className="bind-tabs" role="tablist" aria-label="Bind sections">
          <button
            type="button"
            className={`btn-tab${activeTab === "profile" ? " is-active" : ""}`}
            role="tab"
            aria-selected={activeTab === "profile"}
            onClick={() => setActiveTab("profile")}
          >
            👤 {t("bind.tab_profile")}
          </button>
          <button
            type="button"
            className={`btn-tab${activeTab === "invite" ? " is-active" : ""}`}
            role="tab"
            aria-selected={activeTab === "invite"}
            onClick={() => setActiveTab("invite")}
          >
            🏷️{t("bind.tab_invite")}
          </button>
        </div>
        ) : null}

        {mode === "swipe" ? (
          <>
            <div className="bind-swipe-meta">
              <div className="bind-swipe-meta-pill">
                <span>{me.user.display_name}</span>
                <strong>{isOwner ? `🔗 ${t("role.owner")}` : `🐾 ${t("role.puppy")}`}</strong>
              </div>
              <div className="bind-swipe-meta-pill">
                <span>📬 {t("bind.match_pending_count")}</span>
                <strong>{pendingCount}</strong>
              </div>
              <div className="bind-swipe-meta-pill">
                <span>💌 {t("bind.match_daily_usage")}</span>
                <strong>{dailySentCount}/5</strong>
              </div>
            </div>

            <div className="bind-community-stage">
              {renderFeedStream()}
            </div>

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

            {pendingInvitePost ? (
              <div
                className="bind-composer-backdrop"
                role="dialog"
                aria-modal="true"
                aria-labelledby="bind-invite-title"
                onClick={() => setPendingInvitePost(null)}
              >
                <div className="bind-composer bind-invite-composer" onClick={(event) => event.stopPropagation()}>
                  <h3 id="bind-invite-title">{t("bind.match_send_request")}</h3>
                  <p>
                    {locale === "en"
                      ? `Send an invite to ${pendingInvitePost.display_name || "this user"} after adding an optional note.`
                      : locale === "fr"
                      ? `Envoyez une invitation a ${pendingInvitePost.display_name || "cet utilisateur"} apres avoir ajoute un message optionnel.`
                      : `给 ${pendingInvitePost.display_name || "对方"} 发送邀请前，可以先补一句留言。`}
                  </p>
                  <FormField label={t("bind.match_message_placeholder")}>
                    <Input
                      value={requestMessages[pendingInvitePost.id] || ""}
                      onChange={(event) =>
                        setRequestMessages((current) => ({
                          ...current,
                          [pendingInvitePost.id]: event.target.value,
                        }))
                      }
                      placeholder={t("bind.match_message_placeholder")}
                    />
                  </FormField>
                  <ButtonGroup>
                    <Button type="button" variant="secondary" onClick={() => setPendingInvitePost(null)} disabled={busy}>
                      {t("common.cancel")}
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      role={isOwner ? "owner" : "puppy"}
                      onClick={() => void handleConfirmInvite()}
                      disabled={busy || dailySentCount >= 5 || Boolean(pendingInvitePost.has_pending_request)}
                    >
                      {busy ? t("common.loading") : t("bind.match_send_request")}
                    </Button>
                  </ButtonGroup>
                </div>
              </div>
            ) : null}
          </>
        ) : activeTab === "profile" ? (
          <div className="bind-app-shell">
            <Card className="bind-summary-card">
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

            <div className="bind-stack bind-stack-main">
              <Card role={isOwner ? "owner" : "puppy"} className="bind-flow-card">
                <CardHeader>
                  <div>
                    <h2 style={{ margin: 0 }}>
                      {source === "register" ? onboardingCopy.profileTitle : t("dashboard.nav.profile")}
                    </h2>
                    {source === "register" ? (
                      <p style={{ margin: "8px 0 0", color: "var(--muted)" }}>{onboardingCopy.profileHint}</p>
                    ) : null}
                  </div>
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
                  <div className="bind-form-actions">
                    <Button
                      type="button"
                      variant="primary"
                      role={isOwner ? "owner" : "puppy"}
                      onClick={() => void handleSaveProfile()}
                      disabled={busy || !profileForm.display_name.trim()}
                    >
                      {busy ? t("profile.saving") : t("profile.save")}
                    </Button>
                  </div>
                </CardBody>
              </Card>
            </div>
          </div>
        ) : (
          <div className="bind-app-shell">
            <Card role={isOwner ? "owner" : "puppy"} className="bind-summary-card">
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

            <Card role={isOwner ? "owner" : "puppy"} className="bind-flow-card">
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
                <ButtonGroup className="bind-form-actions">
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


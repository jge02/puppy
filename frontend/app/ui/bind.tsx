"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { translateApiError } from "../../lib/i18n/api-errors";
import { useI18n } from "../../lib/i18n/useI18n";
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

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });

  const data = (await response.json().catch(() => ({}))) as { detail?: string };
  if (!response.ok) {
    throw new Error(data.detail || "Request failed");
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

type BindPanelProps = {
  source?: string;
};

export default function BindPanel({ source }: BindPanelProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [token, setToken] = useState("");
  const [me, setMe] = useState<MeResponse | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

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
        const message = err instanceof Error ? err.message : t("common.request_failed");
        setError(translateApiError(message, t));
      }
    }

    void loadMe();
    return () => {
      cancelled = true;
    };
  }, [router, t, token]);

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
      const message = err instanceof Error ? err.message : t("common.request_failed");
      setError(translateApiError(message, t));
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    if (!me?.user.invite_code) {
      return;
    }
    try {
      await navigator.clipboard.writeText(me.user.invite_code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError(t("common.request_failed"));
    }
  }

  function handleSkip() {
    window.sessionStorage.setItem(SKIP_BIND_KEY, "1");
    router.replace("/dashboard");
  }

  if (!hydrated || !me) {
    return <LoadingState message={t("common.loading_dashboard")} />;
  }

  const sourceCopy =
    source === "register" ? t("bind.source_register") : source === "login" ? t("bind.source_login") : "";
  const isOwner = me.user.role_preference === "owner";

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          padding: "var(--space-6)",
          backgroundColor: "var(--surface-strong)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div className="container dashboard-topbar wrap-on-mobile">
          <div>
            <h1 style={{ margin: 0, fontSize: "var(--text-2xl)" }}>{t("bind.title")}</h1>
            <p style={{ margin: "var(--space-2) 0 0 0", color: "var(--muted)" }}>{t("bind.description")}</p>
          </div>
          <LanguageSwitcher id="bind-language" />
        </div>
      </header>

      <main className="container" style={{ flex: 1 }}>
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
                  <Button type="button" variant="secondary" onClick={() => void handleCopy()}>
                    {copied ? t("bind.copy_done") : t("bind.copy_code")}
                  </Button>
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
                  <Button type="button" variant="secondary" onClick={handleSkip}>
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
      </main>
    </div>
  );
}

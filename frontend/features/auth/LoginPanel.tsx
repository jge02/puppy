"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ChangeEvent, Dispatch, FormEvent, SetStateAction } from "react";

import { translateApiError } from "../../lib/i18n/api-errors";
import { useI18n } from "../../lib/i18n/useI18n";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ErrorState } from "../../components/ErrorState";
import { Form, FormField, Input } from "../../components/FormField";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import "./login.css";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
const TOKEN_KEY = "puppy_token";
const ONBOARDING_KEY = "puppy_onboarding";

type RolePreference = "owner" | "puppy";
type Gender = "male" | "female" | "trans" | "non_binary" | "private";
type SeekingGender = "male" | "female" | "trans" | "non_binary" | "any";
type SexualOrientation = "hetero" | "homo" | "bi" | "pan" | "asexual" | "questioning" | "unspecified";
type IdentityLabel = "lesbian" | "gay" | "femboy" | "ts" | "cd" | "4i";

type RegisterFormState = {
  email: string;
  password: string;
  display_name: string;
  role_preference: RolePreference;
};

type LoginFormState = {
  email: string;
  password: string;
};

type FieldErrors = Partial<Record<"email" | "password" | "display_name", string>>;

type UserSummary = {
  id: string;
  email: string;
  display_name: string;
  role_preference: RolePreference;
  invite_code: string;
  gender: Gender;
  seeking_gender: SeekingGender;
  sexual_orientation: SexualOrientation;
  identity_labels: IdentityLabel[];
};

type AuthResponse = {
  token: string;
  user: UserSummary;
  current_relationship?: { id: string } | null;
};

type MeResponse = {
  current_relationship?: { id: string } | null;
};

type OnboardingSession = {
  email: string;
  display_name: string;
  role_preference: RolePreference;
  invite_code: string;
  gender: Gender;
  seeking_gender: SeekingGender;
  sexual_orientation: SexualOrientation;
  identity_labels: IdentityLabel[];
  profile_completed: boolean;
};

const initialRegister: RegisterFormState = {
  email: "",
  password: "",
  display_name: "",
  role_preference: "owner",
};

const initialLogin: LoginFormState = {
  email: "",
  password: "",
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

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function LoginPanel() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [registerForm, setRegisterForm] = useState<RegisterFormState>(initialRegister);
  const [loginForm, setLoginForm] = useState<LoginFormState>(initialLogin);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const isChinese = locale === "zh-CN" || locale === "zh-TW";
  const stageEyebrow = locale === "en" ? "Quick access" : locale === "fr" ? "Acces rapide" : "快速进入";
  const stageTitle =
    mode === "login"
      ? locale === "en"
        ? "Log in and continue."
        : locale === "fr"
        ? "Connectez-vous et continuez."
        : "登录后继续"
      : locale === "en"
      ? "Create account in one step."
      : locale === "fr"
      ? "Creez votre compte en une etape."
      : "一步创建账号";
  const stageCopy =
    mode === "login"
      ? locale === "en"
        ? "Use your email and password to go back to binding or dashboard."
        : locale === "fr"
        ? "Utilisez votre e-mail et mot de passe pour revenir a la liaison ou au dashboard."
        : "用邮箱和密码回到绑定或仪表盘。"
      : locale === "en"
      ? "Only the basics now. Profile details can be completed after signup."
      : locale === "fr"
      ? "Seulement l'essentiel maintenant. Le profil peut etre complete apres l'inscription."
      : "现在只填最基本的信息，资料细节稍后完善。";
  const nextStepLabel = locale === "en" ? "Next" : locale === "fr" ? "Ensuite" : "下一步";
  const nextStepBody =
    locale === "en"
      ? "After signup, complete your profile before binding and matching."
      : locale === "fr"
      ? "Apres l'inscription, completez votre profil avant la liaison et le matching."
      : "创建完成后先完善资料，再进入绑定与匹配。";
  const modeCopy =
    mode === "login"
      ? {
          title: t("login.login_title"),
          description: t("login.login_description"),
          submit: busy ? t("login.submitting") : t("login.submit"),
          alternateLabel: t("login.no_account"),
          alternateAction: t("login.register_link"),
        }
      : {
          title: t("login.register_title"),
          description: isChinese
            ? "只需要昵称、邮箱、密码和角色偏好。"
            : locale === "en"
            ? "Only display name, email, password, and role are needed."
            : "Seuls le nom, l'e-mail, le mot de passe et le role sont necessaires.",
          submit: busy ? t("login.creating_account") : t("login.create_account"),
          alternateLabel: t("login.have_account"),
          alternateAction: t("login.back_to_login"),
        };

  function setFormField<T extends RegisterFormState | LoginFormState>(
    setter: Dispatch<SetStateAction<T>>,
    key: keyof T
  ) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = event.target.value as T[keyof T];
      setter((current) => ({ ...current, [key]: value }));
      setErrors((current) => ({ ...current, [String(key)]: "" }));
    };
  }

  function persistToken(token: string) {
    window.localStorage.setItem(TOKEN_KEY, token);
  }

  function persistOnboarding(user: UserSummary) {
    const onboarding: OnboardingSession = {
      email: user.email,
      display_name: user.display_name,
      role_preference: user.role_preference,
      invite_code: user.invite_code,
      gender: user.gender,
      seeking_gender: user.seeking_gender,
      sexual_orientation: user.sexual_orientation,
      identity_labels: user.identity_labels,
      profile_completed: false,
    };
    window.sessionStorage.setItem(ONBOARDING_KEY, JSON.stringify(onboarding));
  }

  function validateRegisterForm() {
    const nextErrors: FieldErrors = {};
    if (!registerForm.email) {
      nextErrors.email = t("login.validation.email_required");
    } else if (!validateEmail(registerForm.email)) {
      nextErrors.email = t("login.validation.email_invalid");
    }
    if (!registerForm.password) {
      nextErrors.password = t("login.validation.password_required");
    } else if (registerForm.password.length < 8) {
      nextErrors.password = t("login.validation.password_min");
    }
    if (!registerForm.display_name.trim()) {
      nextErrors.display_name = t("login.validation.display_name_required");
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function validateLoginForm() {
    const nextErrors: FieldErrors = {};
    if (!loginForm.email) {
      nextErrors.email = t("login.validation.email_required");
    } else if (!validateEmail(loginForm.email)) {
      nextErrors.email = t("login.validation.email_invalid");
    }
    if (!loginForm.password) {
      nextErrors.password = t("login.validation.password_required");
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateRegisterForm()) {
      return;
    }

    setBusy(true);
    setError("");
    try {
      const response = (await apiRequest("/auth/register", {
        method: "POST",
        body: {
          email: registerForm.email,
          password: registerForm.password,
          display_name: registerForm.display_name,
          role_preference: registerForm.role_preference,
        },
      })) as AuthResponse;
      persistToken(response.token);
      persistOnboarding(response.user);
      setRegisterForm(initialRegister);
      router.replace("/bind?source=register&tab=profile");
    } catch (err) {
      const message = err instanceof Error ? err.message : t("common.request_failed");
      setError(translateApiError(message, t));
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateLoginForm()) {
      return;
    }

    setBusy(true);
    setError("");
    try {
      const response = (await apiRequest("/auth/login", {
        method: "POST",
        body: loginForm,
      })) as AuthResponse;
      persistToken(response.token);
      const me = (await apiRequest("/me", { token: response.token })) as MeResponse;
      setLoginForm(initialLogin);
      router.replace(me.current_relationship ? "/dashboard" : "/bind?source=login");
    } catch (err) {
      const message = err instanceof Error ? err.message : t("common.request_failed");
      setError(translateApiError(message, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <header className="login-header">
        <div className="login-header-bar">
          <div className="login-brand">
            <div className="login-brand-mark">P</div>
            <div className="login-brand-copy">
              <span className="login-brand-kicker">{stageEyebrow}</span>
              <h1 className="login-brand-title">{t("common.app_name")}</h1>
            </div>
          </div>
          <div className="login-language-wrap">
            <LanguageSwitcher id="login-language" />
          </div>
        </div>
      </header>

      <main className="login-main">
        <div className="login-shell">
          <section className="login-hero">
            <div className="login-hero-copy-block">
              <p className="login-hero-eyebrow">{stageEyebrow}</p>
              <h2 className="login-hero-title">{stageTitle}</h2>
              <p className="login-hero-copy">{stageCopy}</p>
            </div>
            <div className="login-hero-status">
              <span className="login-hero-status-label">
                {mode === "login"
                  ? locale === "en"
                    ? "Returning member"
                    : locale === "fr"
                    ? "Retour"
                    : "回到账号"
                  : locale === "en"
                  ? "New profile"
                  : locale === "fr"
                  ? "Nouveau profil"
                  : "新建资料"}
              </span>
              <strong>{modeCopy.title}</strong>
            </div>
          </section>

          {error ? (
            <div className="login-error-block">
              <ErrorState title={t("common.request_failed")} description={error} />
            </div>
          ) : null}

          <Card className="login-card">
            <div className="login-card-header">
              <div className="login-auth-switch" role="tablist" aria-label="Auth mode">
                <button
                  className={`login-auth-switch-item${mode === "login" ? " is-active" : ""}`}
                  type="button"
                  role="tab"
                  aria-selected={mode === "login"}
                  onClick={() => {
                    setMode("login");
                    setError("");
                    setErrors({});
                  }}
                >
                  {t("login.login_title")}
                </button>
                <button
                  className={`login-auth-switch-item${mode === "register" ? " is-active" : ""}`}
                  type="button"
                  role="tab"
                  aria-selected={mode === "register"}
                  onClick={() => {
                    setMode("register");
                    setError("");
                    setErrors({});
                  }}
                >
                  {t("login.register_title")}
                </button>
              </div>
              <p className="login-card-kicker">
                {mode === "login"
                  ? t("login.header_tagline")
                  : locale === "en"
                  ? "Step one"
                  : locale === "fr"
                  ? "Premiere etape"
                  : "第一步"}
              </p>
              <h2 className="login-card-title">{modeCopy.title}</h2>
              <p className="login-card-copy">{modeCopy.description}</p>
            </div>

            {mode === "login" ? (
              <Form onSubmit={handleLogin} className="login-form">
                <FormField label={t("common.email")} error={errors.email ?? null} required>
                  <Input
                    type="email"
                    placeholder={t("login.email_placeholder")}
                    value={loginForm.email}
                    onChange={setFormField(setLoginForm, "email")}
                    error={Boolean(errors.email)}
                  />
                </FormField>

                <FormField label={t("common.password")} error={errors.password ?? null} required>
                  <Input
                    type="password"
                    placeholder={t("login.password_placeholder")}
                    value={loginForm.password}
                    onChange={setFormField(setLoginForm, "password")}
                    error={Boolean(errors.password)}
                  />
                </FormField>

                <div className="login-submit-area">
                  <Button type="submit" variant="primary" disabled={busy} className="login-submit-button">
                    {modeCopy.submit}
                  </Button>
                </div>
              </Form>
            ) : (
              <Form onSubmit={handleRegister} className="login-form">
                <FormField label={t("common.email")} error={errors.email ?? null} required>
                  <Input
                    type="email"
                    placeholder={t("login.email_placeholder")}
                    value={registerForm.email}
                    onChange={setFormField(setRegisterForm, "email")}
                    error={Boolean(errors.email)}
                  />
                </FormField>

                <FormField label={t("common.display_name")} error={errors.display_name ?? null} required>
                  <Input
                    type="text"
                    placeholder={t("login.display_name_placeholder")}
                    value={registerForm.display_name}
                    onChange={setFormField(setRegisterForm, "display_name")}
                    error={Boolean(errors.display_name)}
                  />
                </FormField>

                <FormField
                  label={t("common.password")}
                  error={errors.password ?? null}
                  hint={t("common.required_password_hint")}
                  required
                >
                  <Input
                    type="password"
                    placeholder={t("login.password_placeholder")}
                    value={registerForm.password}
                    onChange={setFormField(setRegisterForm, "password")}
                    error={Boolean(errors.password)}
                  />
                </FormField>

                <FormField label={t("common.role_preference")} required>
                  <div className="login-role-switch" role="radiogroup" aria-label={t("common.role_preference")}>
                    {([
                      { value: "owner" as const, label: t("role.owner") },
                      { value: "puppy" as const, label: t("role.puppy") },
                    ]).map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={registerForm.role_preference === option.value}
                        className={`login-role-option${registerForm.role_preference === option.value ? " is-active" : ""}`}
                        onClick={() =>
                          setRegisterForm((current) => ({
                            ...current,
                            role_preference: option.value,
                          }))
                        }
                      >
                        <span className="login-role-option-badge">{option.value === "owner" ? "👑" : "🐾"}</span>
                        <span className="login-role-option-copy">
                          <strong>{option.label}</strong>
                          <small>
                            {option.value === "owner"
                              ? locale === "en"
                                ? "Create tasks and steer the flow"
                                : locale === "fr"
                                ? "Creer des taches et guider le rythme"
                                : "发起任务与主导节奏"
                              : locale === "en"
                              ? "Receive, respond, and stay in sync"
                              : locale === "fr"
                              ? "Recevoir, repondre et rester synchronise"
                              : "接收任务并保持同步"}
                          </small>
                        </span>
                      </button>
                    ))}
                  </div>
                </FormField>

                <div className="login-onboarding-note">
                  <strong>{nextStepLabel}</strong>
                  <span>{nextStepBody}</span>
                </div>

                <div className="login-submit-area">
                  <Button type="submit" variant="primary" disabled={busy} className="login-submit-button">
                    {modeCopy.submit}
                  </Button>
                </div>
              </Form>
            )}

            <div className="login-switch-block">
              <p style={{ margin: 0, color: "var(--muted)" }}>
                {modeCopy.alternateLabel}{" "}
                <button
                  className="login-mode-switch"
                  type="button"
                  onClick={() => {
                    setMode(mode === "login" ? "register" : "login");
                    setError("");
                    setErrors({});
                  }}
                >
                  {modeCopy.alternateAction}
                </button>
              </p>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}

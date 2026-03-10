"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ChangeEvent, Dispatch, FormEvent, SetStateAction } from "react";

import { translateApiError } from "../../lib/i18n/api-errors";
import type { MessageKey } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/useI18n";
import { Button } from "./Button";
import { Card } from "./Card";
import { ErrorState } from "./ErrorState";
import { Form, FormField, Input, Select } from "./FormField";
import { LanguageSwitcher } from "./LanguageSwitcher";
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
  gender: Gender;
  seeking_gender: SeekingGender;
  sexual_orientation: SexualOrientation;
  identity_labels: IdentityLabel[];
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

const initialRegister: RegisterFormState = {
  email: "",
  password: "",
  display_name: "",
  role_preference: "owner",
  gender: "private",
  seeking_gender: "any",
  sexual_orientation: "unspecified",
  identity_labels: [],
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

function toggleIdentityLabel(
  current: IdentityLabel[],
  label: IdentityLabel,
) {
  if (current.includes(label)) {
    return current.filter((item) => item !== label);
  }
  return [...current, label];
}

function identityLabelText(label: IdentityLabel, t: (key: MessageKey) => string) {
  if (label === "lesbian") return t("identity.lesbian");
  if (label === "gay") return t("identity.gay");
  if (label === "femboy") return t("identity.femboy");
  if (label === "ts") return t("identity.ts");
  if (label === "cd") return t("identity.cd");
  return t("identity.4i");
}

export default function LoginPanel() {
  const router = useRouter();
  const { t } = useI18n();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [registerForm, setRegisterForm] = useState<RegisterFormState>(initialRegister);
  const [loginForm, setLoginForm] = useState<LoginFormState>(initialLogin);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

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
    window.sessionStorage.setItem(
      ONBOARDING_KEY,
      JSON.stringify({
        email: user.email,
        display_name: user.display_name,
        role_preference: user.role_preference,
        invite_code: user.invite_code,
        gender: user.gender,
        seeking_gender: user.seeking_gender,
        sexual_orientation: user.sexual_orientation,
        identity_labels: user.identity_labels,
      })
    );
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
        body: registerForm,
      })) as AuthResponse;
      persistToken(response.token);
      persistOnboarding(response.user);
      setRegisterForm(initialRegister);
      router.replace("/bind?source=register");
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
      <header
        className="login-header"
        style={{
          padding: "var(--space-6)",
          backgroundColor: "var(--surface-strong)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div className="container">
          <div className="login-header-bar wrap-on-mobile">
            <div className="login-brand">
              <div className="login-brand-mark">P</div>
              <h1 style={{ margin: 0, fontSize: "var(--text-2xl)" }}>{t("common.app_name")}</h1>
            </div>
            <div className="login-language-wrap full-width-mobile">
              <LanguageSwitcher id="login-language" />
            </div>
          </div>
        </div>
      </header>

      <main className="container login-main">
        <div className="login-shell">
          <div className="login-hero">
            <p style={{ color: "var(--brand)", fontWeight: "var(--font-bold)", letterSpacing: "0.1em", margin: 0 }}>
              {t("login.header_tagline")}
            </p>
            <h1 style={{ fontSize: "var(--text-3xl)", marginTop: "var(--space-2)" }}>
              {mode === "login" ? t("login.login_title") : t("login.register_title")}
            </h1>
            <p style={{ color: "var(--muted)", marginTop: "var(--space-2)" }}>
              {mode === "login" ? t("login.login_description") : t("login.register_description")}
            </p>
          </div>

          {error ? (
            <div className="login-error-block">
              <ErrorState title={t("common.request_failed")} description={error} />
            </div>
          ) : null}

          {mode === "login" ? (
            <Card className="login-card">
              <Form onSubmit={handleLogin}>
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

                <Button type="submit" variant="primary" disabled={busy} style={{ width: "100%" }}>
                  {busy ? t("login.submitting") : t("login.submit")}
                </Button>
              </Form>

              <div className="login-switch-block">
                <p style={{ margin: 0, color: "var(--muted)" }}>
                  {t("login.no_account")}{" "}
                  <button
                    className="login-mode-switch"
                    type="button"
                    onClick={() => {
                      setMode("register");
                      setError("");
                      setErrors({});
                    }}
                  >
                    {t("login.register_link")}
                  </button>
                </p>
              </div>
            </Card>
          ) : (
            <Card className="login-card">
              <Form onSubmit={handleRegister}>
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
                  <Select
                    value={registerForm.role_preference}
                    onChange={setFormField(setRegisterForm, "role_preference")}
                    placeholder={t("common.select_option")}
                    options={[
                      { value: "owner", label: t("role.owner") },
                      { value: "puppy", label: t("role.puppy") },
                    ]}
                  />
                </FormField>

                <FormField label={t("common.gender")} required>
                  <Select
                    value={registerForm.gender}
                    onChange={setFormField(setRegisterForm, "gender")}
                    placeholder={t("common.select_option")}
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
                    value={registerForm.seeking_gender}
                    onChange={setFormField(setRegisterForm, "seeking_gender")}
                    placeholder={t("common.select_option")}
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
                    value={registerForm.sexual_orientation}
                    onChange={setFormField(setRegisterForm, "sexual_orientation")}
                    placeholder={t("common.select_option")}
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

                <FormField label={t("common.identity_labels")}>
                  <div className="identity-chip-group" role="group" aria-label={t("common.identity_labels")}>
                    {(["lesbian", "gay", "femboy", "ts", "cd", "4i"] as const).map((label) => (
                      <button
                        key={label}
                        type="button"
                        className={`identity-chip${registerForm.identity_labels.includes(label) ? " is-active" : ""}`}
                        aria-pressed={registerForm.identity_labels.includes(label)}
                        onClick={() =>
                          setRegisterForm((current) => ({
                            ...current,
                            identity_labels: toggleIdentityLabel(current.identity_labels, label),
                          }))
                        }
                      >
                        {identityLabelText(label, t)}
                      </button>
                    ))}
                  </div>
                </FormField>

                <Button type="submit" variant="primary" disabled={busy} style={{ width: "100%" }}>
                  {busy ? t("login.creating_account") : t("login.create_account")}
                </Button>
              </Form>

              <div className="login-switch-block">
                <p style={{ margin: 0, color: "var(--muted)" }}>
                  {t("login.have_account")}{" "}
                  <button
                    className="login-mode-switch"
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setError("");
                      setErrors({});
                    }}
                  >
                    {t("login.back_to_login")}
                  </button>
                </p>
              </div>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}

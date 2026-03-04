"use client";

import { useEffect } from "react";

import { useI18n } from "../../lib/i18n/useI18n";

const TOKEN_KEY = "puppy_token";

export default function HomeRedirect() {
  const { t } = useI18n();

  useEffect(() => {
    const token = window.localStorage.getItem(TOKEN_KEY);
    window.location.replace(token ? "/dashboard" : "/login");
  }, []);

  return <main style={{ padding: "32px" }}>{t("common.redirecting")}</main>;
}

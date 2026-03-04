"use client";

import { localeLabels, locales, type Locale } from "../../lib/i18n/config";
import { useI18n } from "../../lib/i18n/useI18n";

type LanguageSwitcherProps = {
  id?: string;
};

export function LanguageSwitcher({ id }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n();
  const labels = localeLabels[locale] ?? localeLabels.en;

  return (
    <label
      htmlFor={id}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        fontSize: "var(--text-sm)",
        color: "var(--muted)",
      }}
    >
      <span style={{ whiteSpace: "nowrap", flexShrink: 0 }}>{t("common.language")}</span>
      <select
        id={id}
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
        style={{ minWidth: "140px" }}
      >
        {locales.map((item) => (
          <option key={item} value={item}>
            {labels[item]}
          </option>
        ))}
      </select>
    </label>
  );
}

"use client";

import type { ReactNode } from "react";

import { useI18n } from "../lib/i18n/useI18n";

type EmptyStateProps = {
  title?: string;
  description?: string;
  icon?: string;
  action?: ReactNode;
};

export function EmptyState({
  title,
  description,
  icon = "🐾",
  action = null,
}: EmptyStateProps) {
  const { t } = useI18n();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-12)",
        gap: "var(--space-4)",
        minHeight: "200px",
        textAlign: "center",
        animation: "slideInUp var(--transition-slow)",
      }}
    >
      <div
        style={{
          fontSize: "4rem",
          animation: "gentle-bounce 3s ease-in-out infinite",
          display: "inline-block",
        }}
      >
        {icon}
      </div>
      <h3
        style={{
          margin: 0,
          color: "var(--ink)",
          fontSize: "var(--text-xl)",
          fontWeight: "var(--font-semibold)",
        }}
      >
        {title ?? t("common.no_data")}
      </h3>
      <p
        style={{
          color: "var(--muted)",
          maxWidth: "300px",
          margin: 0,
          fontSize: "var(--text-sm)",
          lineHeight: "var(--leading-normal)",
        }}
      >
        {description ?? t("common.nothing_to_show")}
      </p>
      {action ? (
        <div
          style={{
            marginTop: "var(--space-4)",
            animation: "slideInUp var(--transition-slow) backwards 0.2s",
          }}
        >
          {action}
        </div>
      ) : null}
    </div>
  );
}

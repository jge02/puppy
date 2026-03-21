"use client";

import React from "react";
import type { ReactNode } from "react";

import { useI18n } from "../lib/i18n/useI18n";

type ErrorStateProps = {
  title?: string;
  description?: string;
  error?: string | null;
  onRetry?: (() => void) | null;
  icon?: string;
};

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

export function ErrorState({
  title,
  description,
  error = null,
  onRetry = null,
  icon = "⚠️",
}: ErrorStateProps) {
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
        backgroundColor: "var(--danger-bg)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid rgba(255, 82, 82, 0.30)",
        animation: "slideInUp var(--transition-slow)",
      }}
    >
      <div
        style={{
          fontSize: "3.5rem",
          animation: "pulse 2s ease-in-out infinite",
        }}
      >
        {icon}
      </div>
      <h3
        style={{
          color: "var(--danger)",
          margin: 0,
          fontSize: "var(--text-xl)",
          fontWeight: "var(--font-semibold)",
        }}
      >
        {title ?? t("error.generic_title")}
      </h3>
      <p
        style={{
          color: "var(--muted)",
          maxWidth: "400px",
          margin: 0,
          fontSize: "var(--text-sm)",
        }}
      >
        {description ?? t("error.generic_description")}
      </p>
      {error ? (
        <details
          style={{
            width: "100%",
            maxWidth: "400px",
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          <summary
            style={{
              cursor: "pointer",
              color: "var(--danger)",
              fontWeight: "var(--font-medium)",
              padding: "var(--space-2)",
              borderRadius: "var(--radius-md)",
              transition: "background-color var(--transition-base)",
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.backgroundColor = "var(--danger-bg)";
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            {t("common.view_details")}
          </summary>
          <pre
            style={{
              backgroundColor: "var(--surface)",
              padding: "var(--space-3)",
              borderRadius: "var(--radius-md)",
              fontSize: "var(--text-xs)",
              overflow: "auto",
              marginTop: "var(--space-2)",
              maxHeight: "200px",
              color: "var(--muted)",
            }}
          >
            {error}
          </pre>
        </details>
      ) : null}
      {onRetry ? (
        <button
          className="btn-primary"
          onClick={onRetry}
          style={{ marginTop: "var(--space-2)" }}
        >
          {t("common.retry")}
        </button>
      ) : null}
    </div>
  );
}

function DefaultBoundaryFallback({ error }: { error: string | null }) {
  const { t } = useI18n();

  return (
    <ErrorState
      title={t("error.page_crashed_title")}
      description={t("error.page_crashed_description")}
      error={error}
      onRetry={() => window.location.reload()}
    />
  );
}

export function ErrorBoundary({ children, fallback = null }: ErrorBoundaryProps) {
  return <ErrorBoundaryComponent fallback={fallback}>{children}</ErrorBoundaryComponent>;
}

class ErrorBoundaryComponent extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <DefaultBoundaryFallback error={this.state.error?.toString() ?? null} />;
    }

    return this.props.children;
  }
}

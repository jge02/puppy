"use client";

import { useI18n } from "../../lib/i18n/useI18n";

type SpinnerSize = "sm" | "md" | "lg";

type LoadingSpinnerProps = {
  size?: SpinnerSize;
};

type LoadingStateProps = {
  message?: string;
};

export function LoadingSpinner({ size = "md" }: LoadingSpinnerProps) {
  const sizes: Record<SpinnerSize, { width: string; height: string }> = {
    sm: { width: "30px", height: "30px" },
    md: { width: "50px", height: "50px" },
    lg: { width: "80px", height: "80px" },
  };

  return (
    <div
      style={{
        display: "inline-block",
        ...sizes[size],
        position: "relative",
        animation: "spin 1s linear infinite",
      }}
    >
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <svg
        viewBox="0 0 40 40"
        style={{
          width: "100%",
          height: "100%",
          fill: "none",
          stroke: "var(--brand)",
          strokeWidth: "4",
          strokeLinecap: "round",
        }}
      >
        <circle cx="20" cy="20" r="16" opacity="0.2" />
        <path d="M 20, 4 A 16, 16 0 0, 1 36, 20" />
      </svg>
    </div>
  );
}

export function LoadingState({ message }: LoadingStateProps) {
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
        animation: "fadeIn var(--transition-slow)",
      }}
    >
      <div style={{ animation: "gentle-bounce 2s ease-in-out infinite" }}>
        <LoadingSpinner />
      </div>
      <p style={{ color: "var(--muted)", fontSize: "var(--text-sm)" }}>
        {message ?? t("common.loading")}
      </p>
      <div
        style={{
          display: "flex",
          gap: "var(--space-2)",
          marginTop: "var(--space-2)",
        }}
      >
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: "var(--brand)",
              opacity: 0.5,
              animation: "pulse 1.4s ease-in-out infinite",
              animationDelay: `${index * 0.2}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

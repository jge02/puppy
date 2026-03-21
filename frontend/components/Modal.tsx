"use client";

import { useEffect, useState } from "react";
import type { MouseEvent, HTMLAttributes, ReactNode } from "react";


type ModalSize = "sm" | "md" | "lg" | "xl";

type ModalProps = HTMLAttributes<HTMLDivElement> & {
  isOpen?: boolean;
  onClose?: (() => void) | null;
  children: ReactNode;
  title?: string | null;
  size?: ModalSize;
};

type SectionProps = {
  children: ReactNode;
};


export function Modal({
  isOpen = false,
  onClose = null,
  children,
  title,
  className = "",
  size = "md",
  ...props
}: ModalProps) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const panelClasses = ["modal-panel", className].filter(Boolean).join(" ");

  useEffect(() => {
    setShouldRender(isOpen);
  }, [isOpen]);

  if (!shouldRender) {
    return null;
  }

  const sizeStyles: Record<ModalSize, { maxWidth: string }> = {
    sm: { maxWidth: "400px" },
    md: { maxWidth: "600px" },
    lg: { maxWidth: "800px" },
    xl: { maxWidth: "1000px" },
  };

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && onClose) {
      onClose();
    }
  };

  return (
    <div
      className="modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        animation: "fadeIn var(--transition-base)",
      }}
      onClick={handleBackdropClick}
    >
      <div
        className={panelClasses}
        style={{
          backgroundColor: "var(--surface-strong)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-xl)",
          maxHeight: "90vh",
          overflow: "auto",
          width: "100%",
          ...sizeStyles[size],
        }}
        {...props}
      >
        {title ? (
          <div className="modal-header">
            <h2 style={{ margin: 0 }}>{title}</h2>
            {onClose ? (
              <button
                onClick={onClose}
                className="modal-close"
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "1.5rem",
                  cursor: "pointer",
                  padding: 0,
                  color: "var(--muted)",
                }}
              >
                x
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="modal-content">{children}</div>
      </div>
    </div>
  );
}


export function ModalBody({ children }: SectionProps) {
  return <div style={{ padding: "var(--space-6) 0" }}>{children}</div>;
}


export function ModalFooter({ children }: SectionProps) {
  return (
    <div className="modal-footer">
      {children}
    </div>
  );
}

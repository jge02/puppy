import type { HTMLAttributes, ReactNode } from "react";

type BadgeStatus =
  | "default"
  | "open"
  | "submitted"
  | "approved"
  | "fulfilled"
  | "rejected"
  | "expired"
  | "active"
  | "pending"
  | "paused"
  | "ended";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  status?: BadgeStatus;
};

export function Badge({ children, status = "default", className = "", ...props }: BadgeProps) {
  return (
    <span className={`badge badge-${status} ${className}`.trim()} {...props}>
      {children}
    </span>
  );
}

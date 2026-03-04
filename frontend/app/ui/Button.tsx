import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";


type ButtonVariant = "primary" | "secondary";
type ButtonRole = "general" | "owner" | "puppy";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
  role?: ButtonRole;
  size?: ButtonSize;
};

type ButtonGroupProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};


export function Button({
  children,
  variant = "primary",
  role = "general",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  const classes = [
    `btn-${variant}`,
    role !== "general" ? `btn-${role}` : "",
    `btn-${size}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}


export function ButtonGroup({ children, className = "", ...props }: ButtonGroupProps) {
  const classes = ["button-group", className].filter(Boolean).join(" ");

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}

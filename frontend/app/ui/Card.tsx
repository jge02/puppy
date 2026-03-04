import type { HTMLAttributes, ReactNode } from "react";


type CardRole = "general" | "owner" | "puppy";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  role?: CardRole;
  interactive?: boolean;
};

type SectionProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};


export function Card({
  children,
  className = "",
  role = "general",
  interactive = false,
  ...props
}: CardProps) {
  const classes = [
    "card",
    role === "owner" ? "owner-role" : "",
    role === "puppy" ? "puppy-role" : "",
    interactive ? "card-interactive" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}


export function CardHeader({ children, className = "", ...props }: SectionProps) {
  const classes = ["card-header", className].filter(Boolean).join(" ");

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}


export function CardBody({ children, className = "", ...props }: SectionProps) {
  return (
    <div style={{ flex: 1 }} className={className} {...props}>
      {children}
    </div>
  );
}


export function CardFooter({ children, className = "", ...props }: SectionProps) {
  const classes = ["card-footer", className].filter(Boolean).join(" ");

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}

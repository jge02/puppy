import type {
  FormEventHandler,
  FormHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

type FormFieldProps = {
  label?: string | null;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  className?: string;
  hint?: string | null;
};

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: boolean;
};

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  error?: boolean;
};

type SelectOption = {
  value: string;
  label: string;
};

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  options?: SelectOption[];
  error?: boolean;
  placeholder?: string;
};

type FormProps = FormHTMLAttributes<HTMLFormElement> & {
  children: ReactNode;
  onSubmit?: FormEventHandler<HTMLFormElement>;
};

export function FormField({
  label = null,
  error = null,
  required = false,
  children,
  className = "",
  hint = null,
}: FormFieldProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        marginBottom: "var(--space-4)",
      }}
      className={className}
    >
      {label ? (
        <label style={{ fontWeight: "var(--font-medium)" }}>
          {label}
          {required ? <span style={{ color: "var(--danger)", marginLeft: "4px" }}>*</span> : null}
        </label>
      ) : null}
      {children}
      {hint && !error ? <small style={{ color: "var(--muted)", fontSize: "var(--text-sm)" }}>{hint}</small> : null}
      {error ? <small style={{ color: "var(--danger)", fontSize: "var(--text-sm)" }}>{error}</small> : null}
    </div>
  );
}

export function Input({ error = false, style, ...props }: InputProps) {
  return <input style={{ ...style, borderColor: error ? "var(--danger)" : style?.borderColor }} {...props} />;
}

export function Textarea({ error = false, style, ...props }: TextareaProps) {
  return <textarea style={{ ...style, borderColor: error ? "var(--danger)" : style?.borderColor }} {...props} />;
}

export function Select({
  options = [],
  error = false,
  placeholder = "",
  style,
  ...props
}: SelectProps) {
  return (
    <select style={{ ...style, borderColor: error ? "var(--danger)" : style?.borderColor }} {...props}>
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function Form({ children, className = "", onSubmit, ...props }: FormProps) {
  const classes = ["form-stack", className].filter(Boolean).join(" ");

  return (
    <form onSubmit={onSubmit} className={classes} {...props}>
      {children}
    </form>
  );
}

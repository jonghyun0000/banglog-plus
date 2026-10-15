import type { ButtonHTMLAttributes, ReactNode } from "react";
export function Button({
  children,
  secondary = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { secondary?: boolean }) {
  return (
    <button
      className={secondary ? "button secondary" : "button primary"}
      {...props}
    >
      {children}
    </button>
  );
}
export function SectionTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="section-title">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1 tabIndex={-1}>{title}</h1>
      {children && <div className="intro">{children}</div>}
    </div>
  );
}
export function Choice({
  value,
  current,
  label,
  onChange,
}: {
  value: string;
  current: string;
  label: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className={`choice ${current === value ? "selected" : ""}`}>
      <input
        type="radio"
        checked={current === value}
        onChange={() => onChange(value)}
      />
      <span>{label}</span>
      <span aria-hidden="true" className="radio-mark">
        {current === value ? "✓" : ""}
      </span>
    </label>
  );
}
export function ArrowIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m9 5 7 7-7 7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

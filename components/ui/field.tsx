import type { InputHTMLAttributes, ReactNode } from "react";

export const inputClass =
  "block min-h-12 w-full rounded-lg border border-line bg-white px-4 py-2 text-base text-ink placeholder:text-muted focus:border-accent";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: ReactNode;
}

/** A labelled input. The label is always visible and tied to the input. */
export function Field({ label, hint, id, className = "", ...rest }: FieldProps) {
  const inputId = id ?? `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="mb-4">
      <label htmlFor={inputId} className="mb-1.5 block text-base font-semibold">
        {label}
      </label>
      <input id={inputId} className={`${inputClass} ${className}`} {...rest} />
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
    </div>
  );
}

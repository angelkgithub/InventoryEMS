import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-dark border-accent",
  secondary: "bg-white text-ink hover:bg-accent-soft border-line",
  danger: "bg-white text-bad-ink hover:bg-bad-bg border-bad-ink",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  loadingText?: string;
}

/** Large, obvious button (48px tall). While `loading` it is disabled so it cannot be double-clicked. */
export function Button({ variant = "secondary", loading, loadingText = "Saving...", className = "", children, disabled, type = "button", ...rest }: Props) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border px-5 py-2 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {loading ? (
        <>
          <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          {loadingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}

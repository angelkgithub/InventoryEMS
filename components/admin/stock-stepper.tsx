"use client";

interface Props {
  name: string;
  value: number;
  busy: boolean;
  onStep: (direction: 1 | -1) => void;
  onEdit: () => void;
}

const stepButton =
  "flex size-14 shrink-0 sm:size-12 items-center justify-center rounded-lg border-2 border-accent bg-white text-3xl font-bold leading-none text-accent hover:bg-accent-soft disabled:cursor-not-allowed disabled:border-line disabled:text-muted disabled:opacity-60";

/** [ - ]  57  [ + ]. Click the number itself to type an exact amount. */
export function StockStepper({ name, value, busy, onStep, onEdit }: Props) {
  return (
    <div className="flex items-center gap-2" aria-busy={busy || undefined}>
      <button type="button" className={stepButton} disabled={busy || value <= 0} onClick={() => onStep(-1)} aria-label={`Remove 1 from ${name}`}>
        {"−"}
      </button>
      <button
        type="button"
        onClick={onEdit}
        disabled={busy}
        aria-label={`${name}: ${value} in stock. Click to enter an exact amount.`}
        className="min-h-14 min-w-20 rounded-lg sm:min-h-12 sm:min-w-16 border-2 border-dashed border-line bg-white px-3 text-2xl font-bold tabular-nums hover:border-accent hover:bg-accent-soft"
      >
        {value}
      </button>
      <button type="button" className={stepButton} disabled={busy} onClick={() => onStep(1)} aria-label={`Add 1 to ${name}`}>
        +
      </button>
    </div>
  );
}

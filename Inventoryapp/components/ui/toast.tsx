"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface ToastState {
  message: string;
  kind: "success" | "error";
  undo?: () => void;
}

/** One message at the bottom of the screen. Announced to screen readers. */
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const dismiss = useCallback(() => setToast(null), []);
  const show = useCallback((t: ToastState) => {
    clearTimeout(timer.current);
    setToast(t);
    timer.current = setTimeout(() => setToast(null), t.undo ? 10000 : t.kind === "error" ? 8000 : 4000);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const node = (
    <div className="no-print pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4" role="status" aria-live="polite">
      {toast && (
        <div
          className={`pointer-events-auto flex max-w-xl flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border-2 px-5 py-3 text-base font-semibold shadow-lg ${
            toast.kind === "success" ? "border-ok-ink bg-ok-bg text-ok-ink" : "border-bad-ink bg-bad-bg text-bad-ink"
          }`}
        >
          <span>{toast.message}</span>
          {toast.undo && (
            <button
              type="button"
              onClick={() => {
                const undo = toast.undo;
                dismiss();
                undo?.();
              }}
              className="min-h-11 rounded-lg border-2 border-current bg-white px-4 font-bold"
            >
              Undo
            </button>
          )}
          <button type="button" onClick={dismiss} aria-label="Dismiss message" className="min-h-11 min-w-11 rounded-lg text-xl">
            {"✕"}
          </button>
        </div>
      )}
    </div>
  );

  return { show, node };
}

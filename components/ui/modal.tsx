"use client";

import { useEffect, useRef } from "react";

interface Props {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

/** Accessible modal built on the native <dialog>: focus is trapped and Esc closes it. */
export function Modal({ title, onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby="modal-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-auto max-h-[92dvh] w-[min(32rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-line bg-card p-0 text-ink shadow-lg"
    >
      <div className="p-4 sm:p-6">
        <h2 id="modal-title" className="mb-5 text-2xl font-bold">
          {title}
        </h2>
        {children}
      </div>
    </dialog>
  );
}

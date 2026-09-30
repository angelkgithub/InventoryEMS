"use client";

import { useEffect, useState } from "react";

const FORMAT: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" };

/** Shows a timestamp in the viewer's own time zone (the server only knows UTC). */
export function LocalTime({ iso, fallback = "—" }: { iso: string | null; fallback?: string }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    setText(iso ? new Date(iso).toLocaleString("en-US", FORMAT) : null);
  }, [iso]);
  return <time dateTime={iso ?? undefined}>{text ?? (iso ? " " : fallback)}</time>;
}

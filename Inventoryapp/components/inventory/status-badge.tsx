import { getStatus, STATUS_LABEL } from "@/lib/inventory/status";
import type { StockStatus } from "@/types/inventory";

const STYLE: Record<StockStatus, { box: string; icon: string }> = {
  in_stock: { box: "bg-ok-bg text-ok-ink border-ok-ink", icon: "✓" },
  low_stock: { box: "bg-warn-bg text-warn-ink border-warn-ink", icon: "!" },
  out_of_stock: { box: "bg-bad-bg text-bad-ink border-bad-ink", icon: "✕" },
};

/** Status is shown with a text label AND an icon, never color alone. */
export function StatusBadge({ inventory, threshold }: { inventory: number; threshold: number }) {
  const status = getStatus(inventory, threshold);
  const s = STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-sm font-bold tracking-wide ${s.box}`}>
      <span aria-hidden>{s.icon}</span>
      {STATUS_LABEL[status]}
    </span>
  );
}

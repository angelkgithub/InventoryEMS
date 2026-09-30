import { getStatus } from "@/lib/inventory/status";
import type { Product } from "@/types/inventory";

export function SummaryCards({ products }: { products: Product[] }) {
  const active = products.filter((p) => p.active);
  const stats = [
    { label: "TOTAL PRODUCTS", value: active.length },
    { label: "TOTAL UNITS", value: active.reduce((sum, p) => sum + p.inventory, 0) },
    { label: "LOW STOCK", value: active.filter((p) => getStatus(p.inventory, p.low_stock_threshold) === "low_stock").length },
    { label: "OUT OF STOCK", value: active.filter((p) => p.inventory === 0).length },
  ];
  return (
    <ul className="no-print mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((s) => (
        <li key={s.label} className="rounded-xl border border-line bg-card p-5 shadow-sm">
          <p className="text-base font-semibold tracking-wide text-muted">{s.label}</p>
          <p className="mt-1 text-4xl font-bold tabular-nums">{s.value.toLocaleString("en-US")}</p>
        </li>
      ))}
    </ul>
  );
}

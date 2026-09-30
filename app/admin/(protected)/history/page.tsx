import type { Metadata } from "next";
import Link from "next/link";
import { LocalTime } from "@/components/ui/local-time";
import { requireAdmin } from "@/lib/auth";
import { inputClass } from "@/components/ui/field";
import type { HistoryRow, TransactionType } from "@/types/inventory";

export const metadata: Metadata = { title: "Inventory History" };

const PAGE_SIZE = 50;

const FILTERS = [
  { value: "all", label: "All" },
  { value: "stock_added", label: "Stock Added" },
  { value: "stock_removed", label: "Stock Removed" },
  { value: "manual_adjustment", label: "Manual Adjustment" },
] as const;

const TYPE_LABEL: Record<TransactionType, string> = {
  stock_added: "Stock Added",
  stock_removed: "Stock Removed",
  manual_adjustment: "Manual Adjustment",
  initial_stock: "Starting Stock",
};

type Params = { q?: string; type?: string; page?: string };

const href = (p: { q: string; type: string; page?: number }) => {
  const sp = new URLSearchParams();
  if (p.q) sp.set("q", p.q);
  if (p.type !== "all") sp.set("type", p.type);
  if (p.page && p.page > 1) sp.set("page", String(p.page));
  const s = sp.toString();
  return `/admin/history${s ? `?${s}` : ""}`;
};

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

export default async function HistoryPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 100);
  const type = FILTERS.some((f) => f.value === params.type) ? (params.type as string) : "all";
  const page = Math.max(1, Math.floor(Number(params.page)) || 1);

  const { supabase } = await requireAdmin();
  let query = supabase
    .from("inventory_transactions")
    .select(
      "id, previous_quantity, quantity_change, new_quantity, transaction_type, note, created_by_name, created_at, products!inner(product_name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (type !== "all") query = query.eq("transaction_type", type);
  if (q) query = query.ilike("products.product_name", `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);

  const { data, count, error } = await query;
  if (error) console.error("history query failed", error);
  const rows = (data ?? []) as unknown as HistoryRow[];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div>
      <h1 className="mb-1 text-4xl font-bold tracking-tight">History</h1>
      <p className="mb-6 text-lg text-muted">Every stock change, newest first. This list cannot be edited.</p>

      <form action="/admin/history" className="mb-4 flex flex-wrap gap-3">
        <label htmlFor="history-search" className="sr-only">Search history by product</label>
        <input id="history-search" name="q" type="search" defaultValue={q} placeholder="Search by product..." className={`${inputClass} min-w-0 flex-1 sm:max-w-md`} />
        {type !== "all" && <input type="hidden" name="type" value={type} />}
        <button type="submit" className="min-h-12 rounded-lg border border-accent bg-accent px-5 text-base font-semibold text-white hover:bg-accent-dark">
          Search
        </button>
      </form>

      <nav aria-label="Filter by type" className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = type === f.value;
          return (
            <Link
              key={f.value}
              href={href({ q, type: f.value })}
              aria-current={active ? "true" : undefined}
              className={`flex min-h-11 items-center rounded-full border-2 px-4 text-base font-semibold ${active ? "border-accent bg-accent text-white" : "border-line bg-white hover:bg-accent-soft"}`}
            >
              {active && <span aria-hidden>{"✓ "}</span>}
              {f.label}
            </Link>
          );
        })}
      </nav>

      {error ? (
        <p role="alert" className="rounded-xl border-2 border-bad-ink bg-bad-bg p-6 text-lg font-semibold text-bad-ink">Unable to load history. Please try again.</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-line bg-card p-8 text-center text-xl">No changes found.</p>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-line bg-card md:block">
            <table className="w-full text-left text-base">
              <caption className="sr-only">Inventory history</caption>
              <thead className="border-b border-line bg-page">
                <tr>
                  <th scope="col" className="px-4 py-3">Date/Time</th>
                  <th scope="col" className="px-4 py-3">Product</th>
                  <th scope="col" className="px-4 py-3 text-right">Previous</th>
                  <th scope="col" className="px-4 py-3 text-right">Change</th>
                  <th scope="col" className="px-4 py-3 text-right">New Quantity</th>
                  <th scope="col" className="px-4 py-3">Type</th>
                  <th scope="col" className="px-4 py-3">Note</th>
                  <th scope="col" className="px-4 py-3">Admin</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-line align-top last:border-0">
                    <td className="whitespace-nowrap px-4 py-3"><LocalTime iso={r.created_at} /></td>
                    <td className="px-4 py-3 font-semibold">{r.products?.product_name ?? "Unknown product"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.previous_quantity}</td>
                    <td className="px-4 py-3 text-right text-lg font-bold tabular-nums">{signed(r.quantity_change)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.new_quantity}</td>
                    <td className="whitespace-nowrap px-4 py-3">{TYPE_LABEL[r.transaction_type]}</td>
                    <td className="px-4 py-3">{r.note ?? ""}</td>
                    <td className="px-4 py-3">{r.created_by_name ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 md:hidden">
            {rows.map((r) => (
              <li key={r.id} className="rounded-xl border border-line bg-card p-4">
                <p className="text-lg font-semibold">{r.products?.product_name ?? "Unknown product"}</p>
                <p className="mb-2 text-base text-muted"><LocalTime iso={r.created_at} /></p>
                <p className="text-base">
                  {r.previous_quantity} <span aria-hidden>{"→"}</span><span className="sr-only">changed by</span>{" "}
                  <strong className="text-xl">{signed(r.quantity_change)}</strong> <span aria-hidden>{"→"}</span><span className="sr-only">to</span>{" "}
                  <strong>{r.new_quantity}</strong>
                </p>
                <p className="text-base">{TYPE_LABEL[r.transaction_type]}{r.created_by_name ? ` · ${r.created_by_name}` : ""}</p>
                {r.note && <p className="text-base">Note: {r.note}</p>}
              </li>
            ))}
          </ul>

          <div className="mt-6 flex items-center justify-between gap-3 text-base">
            {page > 1 ? (
              <Link href={href({ q, type, page: page - 1 })} className="flex min-h-12 items-center rounded-lg border border-line bg-white px-5 font-semibold hover:bg-accent-soft">Newer</Link>
            ) : <span />}
            <span>Page {page} of {totalPages}</span>
            {page < totalPages ? (
              <Link href={href({ q, type, page: page + 1 })} className="flex min-h-12 items-center rounded-lg border border-line bg-white px-5 font-semibold hover:bg-accent-soft">Older</Link>
            ) : <span />}
          </div>
        </>
      )}
    </div>
  );
}

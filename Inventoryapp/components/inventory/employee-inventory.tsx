"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_FILTERS, filterAndSort, latestUpdate, type ListFilters } from "@/lib/inventory/filter";
import type { PublicProduct } from "@/types/inventory";
import { ListControls } from "./list-controls";
import { StatusBadge } from "./status-badge";
import { LocalTime } from "@/components/ui/local-time";
import { Button } from "@/components/ui/button";

const REFRESH_MS = 30_000;

/** Read-only inventory for employees. Re-checks the database every 30 seconds and when the tab is reopened. */
export function EmployeeInventory({ initialItems, initialError }: { initialItems: PublicProduct[]; initialError: boolean }) {
  const [items, setItems] = useState(initialItems);
  const [failed, setFailed] = useState(initialError);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<ListFilters>(DEFAULT_FILTERS);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/inventory", { cache: "no-store" });
      if (!res.ok) throw new Error("bad response");
      const body = (await res.json()) as { items: PublicProduct[] };
      setItems(body.items);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [refresh]);

  const visible = useMemo(() => filterAndSort(items, filters), [items, filters]);
  const lastUpdated = useMemo(() => latestUpdate(items), [items]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-base">
          <span className="font-semibold">Last updated:</span> <LocalTime iso={lastUpdated} />
        </p>
        <Button onClick={() => void refresh()} loading={refreshing} loadingText="Refreshing..." className="no-print">
          Refresh
        </Button>
      </div>

      {failed && (
        <p role="alert" className="mb-4 rounded-lg border-2 border-warn-ink bg-warn-bg p-4 text-base font-semibold text-warn-ink">
          We could not load the latest inventory. {items.length > 0 ? "The numbers below may be out of date. " : ""}
          Please press Refresh.
        </p>
      )}

      <ListControls filters={filters} onChange={setFilters} searchPlaceholder="Search medication..." resultCount={visible.length} />

      {visible.length === 0 ? (
        <p className="mt-8 rounded-xl border border-line bg-card p-8 text-center text-xl">
          {items.length === 0 ? "No products to show yet." : "No products match your search."}
        </p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="mt-6 hidden overflow-hidden rounded-xl border border-line bg-card md:block">
            <table className="w-full text-left text-lg">
              <caption className="sr-only">Current product availability</caption>
              <thead className="border-b border-line bg-page text-base">
                <tr>
                  <th scope="col" className="px-5 py-3">Product Name</th>
                  <th scope="col" className="px-5 py-3">Category</th>
                  <th scope="col" className="px-5 py-3 text-right">Available Stock</th>
                  <th scope="col" className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p, i) => (
                  <tr key={`${p.product_name}-${i}`} className="border-b border-line last:border-0">
                    <th scope="row" className="px-5 py-3 font-semibold">
                      {p.product_name}
                      {p.sku && <span className="block text-sm font-normal text-muted">{p.sku}</span>}
                    </th>
                    <td className="px-5 py-3">{p.category ?? "Other"}</td>
                    <td className="px-5 py-3 text-right text-3xl font-bold tabular-nums">{p.inventory}</td>
                    <td className="px-5 py-3">
                      <StatusBadge inventory={p.inventory} threshold={p.low_stock_threshold} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phone cards */}
          <ul className="mt-6 space-y-3 pb-8 md:hidden">
            {visible.map((p, i) => (
              <li key={`${p.product_name}-${i}`} className="flex items-center justify-between gap-4 rounded-xl border border-line bg-card p-4">
                <div className="min-w-0">
                  <p className="text-lg font-semibold leading-snug">{p.product_name}</p>
                  <p className="mb-2 text-base text-muted">{p.category ?? "Other"}</p>
                  <StatusBadge inventory={p.inventory} threshold={p.low_stock_threshold} />
                </div>
                <div className="shrink-0 text-center">
                  <p className="text-base font-semibold">Stock</p>
                  <p className="text-4xl font-bold tabular-nums">{p.inventory}</p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

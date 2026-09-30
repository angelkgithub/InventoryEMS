"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { adjustInventoryAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { LocalTime } from "@/components/ui/local-time";
import { useToast } from "@/components/ui/toast";
import { ListControls } from "@/components/inventory/list-controls";
import { StatusBadge } from "@/components/inventory/status-badge";
import { DEFAULT_FILTERS, filterAndSort, type ListFilters } from "@/lib/inventory/filter";
import { downloadCsv, inventoryToCsv } from "@/lib/inventory/csv";
import type { Product } from "@/types/inventory";
import { AdjustStockModal } from "./adjust-stock-modal";
import { ProductFormModal } from "./product-form-modal";
import { QuantityModal } from "./quantity-modal";
import { StockStepper } from "./stock-stepper";
import { SummaryCards } from "./summary-cards";

type Dialog =
  | { kind: "quantity"; product: Product }
  | { kind: "adjust"; productId?: string }
  | { kind: "product"; product?: Product }
  | null;

export function InventoryManager({ initialProducts, showSummary = false }: { initialProducts: Product[]; showSummary?: boolean }) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [filters, setFilters] = useState<ListFilters>(DEFAULT_FILTERS);
  const [showArchived, setShowArchived] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const { show, node: toastNode } = useToast();

  // Pick up fresh data after add / edit / archive (router.refresh) or a page reload.
  useEffect(() => setProducts(initialProducts), [initialProducts]);

  const setBusyFor = (id: string, on: boolean) =>
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const applyStock = useCallback((id: string, inventory: number, updatedAt: string) => {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, inventory, updated_at: updatedAt } : p)));
  }, []);

  /** +1 / -1: saves immediately and offers Undo. */
  const step = useCallback(
    async (product: Product, direction: 1 | -1, isUndo = false) => {
      if (busy.has(product.id)) return;
      setBusyFor(product.id, true);
      const res = await adjustInventoryAction({
        productId: product.id,
        action: direction === 1 ? "add" : "remove",
        quantity: 1,
        note: isUndo ? "Undo" : undefined,
      });
      setBusyFor(product.id, false);
      if (!res.ok) return show({ kind: "error", message: res.error });
      applyStock(product.id, res.newQuantity, res.updatedAt);
      show({
        kind: "success",
        message: isUndo ? `Change undone. ${product.product_name} is back to ${res.newQuantity}.` : `Inventory updated. ${product.product_name} is now ${res.newQuantity}.`,
        undo: isUndo ? undefined : () => void step({ ...product, inventory: res.newQuantity }, direction === 1 ? -1 : 1, true),
      });
    },
    [busy, applyStock, show],
  );

  const onSaved = (product: Product, newQuantity: number, updatedAt: string) => {
    applyStock(product.id, newQuantity, updatedAt);
    setDialog(null);
    show({ kind: "success", message: "Inventory updated successfully." });
  };

  const onProductDone = (message: string) => {
    setDialog(null);
    show({ kind: "success", message });
    router.refresh();
  };

  const visible = useMemo(() => {
    const list = filterAndSort(products, filters);
    return showArchived ? list : list.filter((p) => p.active);
  }, [products, filters, showArchived]);
  const archivedCount = products.filter((p) => !p.active).length;

  return (
    <div>
      {showSummary && <SummaryCards products={products} />}

      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-3xl font-bold">Inventory</h2>
        <div className="flex w-full flex-wrap gap-3 sm:w-auto">
          <Button variant="primary" className="flex-1 sm:flex-none" onClick={() => setDialog({ kind: "adjust" })}>Adjust Stock</Button>
          <Button className="flex-1 sm:flex-none" onClick={() => setDialog({ kind: "product" })}>Add Product</Button>
        </div>
      </div>

      <ListControls filters={filters} onChange={setFilters} searchPlaceholder="Search medications..." resultCount={visible.length} />

      <div className="no-print mt-4 flex flex-wrap items-center gap-3">
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-base font-semibold">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="size-5 accent-accent" />
          Show archived products{archivedCount > 0 ? ` (${archivedCount})` : ""}
        </label>
        <div className="flex w-full gap-3 sm:ml-auto sm:w-auto">
          <Button onClick={() => downloadCsv(`inventory-${new Date().toISOString().slice(0, 10)}.csv`, inventoryToCsv(visible))}>Export CSV</Button>
          <Button className="hidden sm:inline-flex" onClick={() => window.print()}>Print</Button>
          <Button onClick={() => router.refresh()}>Refresh</Button>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="mt-6 rounded-xl border border-line bg-card p-8 text-center text-xl">No products match your search.</p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="print-table mt-6 hidden overflow-hidden rounded-xl border border-line bg-card lg:block">
            <table className="w-full text-left text-base">
              <caption className="sr-only">Inventory</caption>
              <thead className="border-b border-line bg-page">
                <tr>
                  <th scope="col" className="px-4 py-3">Product</th>
                  <th scope="col" className="px-4 py-3">Category</th>
                  <th scope="col" className="px-4 py-3">Stock</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Last Updated</th>
                  <th scope="col" className="no-print px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <tr key={p.id} className="border-b border-line align-middle last:border-0">
                    <th scope="row" className="px-4 py-3 font-semibold">
                      {p.product_name}
                      {!p.active && <span className="ml-2 rounded border border-line bg-page px-2 py-0.5 text-sm">Archived</span>}
                      {p.sku && <span className="block text-sm font-normal text-muted">{p.sku}</span>}
                    </th>
                    <td className="px-4 py-3">{p.category ?? "Other"}</td>
                    <td className="px-4 py-3">
                      <span className="hidden text-2xl font-bold tabular-nums print:inline">{p.inventory}</span>
                      <div className="no-print">
                        {p.active ? (
                          <StockStepper name={p.product_name} value={p.inventory} busy={busy.has(p.id)} onStep={(d) => void step(p, d)} onEdit={() => setDialog({ kind: "quantity", product: p })} />
                        ) : (
                          <span className="text-2xl font-bold tabular-nums">{p.inventory}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3"><StatusBadge inventory={p.inventory} threshold={p.low_stock_threshold} /></td>
                    <td className="px-4 py-3"><LocalTime iso={p.updated_at} /></td>
                    <td className="no-print px-4 py-3">
                      <Button onClick={() => setDialog({ kind: "product", product: p })} aria-label={`Edit ${p.product_name}`}>Edit</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phone cards */}
          <ul className="print-hide-cards mt-6 space-y-3 pb-24 lg:hidden">
            {visible.map((p) => (
              <li key={p.id} className="rounded-xl border border-line bg-card p-4">
                <p className="text-lg font-semibold leading-snug">{p.product_name}</p>
                <p className="mb-3 text-base text-muted">
                  {p.category ?? "Other"}
                  {!p.active && " · Archived"}
                </p>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  {p.active ? (
                    <StockStepper name={p.product_name} value={p.inventory} busy={busy.has(p.id)} onStep={(d) => void step(p, d)} onEdit={() => setDialog({ kind: "quantity", product: p })} />
                  ) : (
                    <span className="text-3xl font-bold tabular-nums">{p.inventory}</span>
                  )}
                  <StatusBadge inventory={p.inventory} threshold={p.low_stock_threshold} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-base text-muted">Updated <LocalTime iso={p.updated_at} /></span>
                  <Button onClick={() => setDialog({ kind: "product", product: p })} aria-label={`Edit ${p.product_name}`}>Edit</Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {dialog?.kind === "quantity" && <QuantityModal product={dialog.product} onClose={() => setDialog(null)} onSaved={onSaved} />}
      {dialog?.kind === "adjust" && <AdjustStockModal products={products} initialProductId={dialog.productId} onClose={() => setDialog(null)} onSaved={onSaved} />}
      {dialog?.kind === "product" && <ProductFormModal product={dialog.product} onClose={() => setDialog(null)} onDone={onProductDone} />}
      {toastNode}
    </div>
  );
}

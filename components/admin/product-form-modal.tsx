"use client";

import { useState, useTransition } from "react";
import { createProductAction, setProductActiveAction, updateProductAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { CATEGORY_SUGGESTIONS } from "@/lib/inventory/filter";
import type { Product } from "@/types/inventory";

interface Props {
  /** Undefined = add a new product. */
  product?: Product;
  onClose: () => void;
  onDone: (message: string) => void;
}

const num = (v: string) => (v.trim() === "" ? Number.NaN : Number(v));

export function ProductFormModal({ product, onClose, onDone }: Props) {
  const editing = !!product;
  const [name, setName] = useState(product?.product_name ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [inventory, setInventory] = useState("0");
  const [threshold, setThreshold] = useState(String(product?.low_stock_threshold ?? 5));
  const [error, setError] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>) => {
    if (pending) return;
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.ok) onDone(res.message);
      else setError(res.error);
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const fields = { name, sku, category, lowStockThreshold: num(threshold) };
      const res = product
        ? await updateProductAction({ ...fields, productId: product.id })
        : await createProductAction({ ...fields, inventory: num(inventory) });
      return res.ok ? { ok: true, message: product ? "Product saved." : "Product added." } : res;
    });
  };

  const toggleActive = () =>
    run(async () => {
      if (!product) return { ok: false, error: "Unable to change the product. Please try again." };
      const res = await setProductActiveAction({ productId: product.id, active: !product.active });
      return res.ok ? { ok: true, message: product.active ? "Product archived." : "Product restored." } : res;
    });

  return (
    <Modal title={editing ? "Edit Product" : "Add Product"} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <Field label="Product Name *" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} required autoFocus />
        <Field label="SKU / NDC" value={sku} onChange={(e) => setSku(e.target.value)} maxLength={100} />
        <Field label="Category" value={category} onChange={(e) => setCategory(e.target.value)} maxLength={60} list="category-options" hint="Leave empty if unsure. It will show as Other." />
        <datalist id="category-options">
          {CATEGORY_SUGGESTIONS.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        {!editing && (
          <Field label="Starting Inventory" type="number" inputMode="numeric" min={0} step={1} value={inventory} onChange={(e) => setInventory(e.target.value)} />
        )}
        <Field label="Low Stock Alert At" type="number" inputMode="numeric" min={0} step={1} value={threshold} onChange={(e) => setThreshold(e.target.value)} hint="Shows LOW STOCK when the amount is this number or less." />
        {editing && <p className="-mt-2 mb-4 text-base text-muted">To change how many are in stock, close this and use the + / - buttons or click the number.</p>}

        {error && (
          <p role="alert" className="mb-4 rounded-lg border-2 border-bad-ink bg-bad-bg p-3 text-base font-semibold text-bad-ink">
            {error}
          </p>
        )}

        {confirmArchive && product ? (
          <div className="rounded-lg border-2 border-warn-ink bg-warn-bg p-4">
            <p className="mb-3 text-base font-semibold text-warn-ink">
              Archive this product? It will disappear from the employee page. You can restore it any time.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="danger" onClick={toggleActive} loading={pending} loadingText="Archiving...">
                Yes, Archive
              </Button>
              <Button onClick={() => setConfirmArchive(false)} disabled={pending}>
                Keep Product
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              {product &&
                (product.active ? (
                  <Button variant="danger" onClick={() => setConfirmArchive(true)} disabled={pending}>
                    Archive Product
                  </Button>
                ) : (
                  <Button onClick={toggleActive} loading={pending} loadingText="Restoring...">
                    Restore Product
                  </Button>
                ))}
            </div>
            <div className="flex gap-3">
              <Button onClick={onClose} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={pending}>
                {editing ? "Save Changes" : "Add Product"}
              </Button>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}

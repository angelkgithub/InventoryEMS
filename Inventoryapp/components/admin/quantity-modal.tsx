"use client";

import { useState, useTransition } from "react";
import { adjustInventoryAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import type { Product } from "@/types/inventory";

interface Props {
  product: Product;
  onClose: () => void;
  onSaved: (product: Product, newQuantity: number, updatedAt: string) => void;
}

/** "Update Inventory": type an exact new amount for one product. */
export function QuantityModal({ product, onClose, onSaved }: Props) {
  const [value, setValue] = useState(String(product.inventory));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setError(null);
    start(async () => {
      const res = await adjustInventoryAction({
        productId: product.id,
        action: "set",
        quantity: value.trim() === "" ? Number.NaN : Number(value),
        note: note || undefined,
      });
      if (res.ok) onSaved(product, res.newQuantity, res.updatedAt);
      else setError(res.error);
    });
  };

  return (
    <Modal title="Update Inventory" onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <p className="text-base font-semibold">Product</p>
        <p className="mb-3 text-xl">{product.product_name}</p>
        <p className="text-base font-semibold">Current stock</p>
        <p className="mb-4 text-3xl font-bold tabular-nums">{product.inventory}</p>
        <Field label="New stock" type="number" inputMode="numeric" min={0} step={1} value={value} onChange={(e) => setValue(e.target.value)} autoFocus onFocus={(e) => e.currentTarget.select()} />
        <div className="mb-4">
          <label htmlFor="qty-note" className="mb-1.5 block text-base font-semibold">
            Note (optional)
          </label>
          <input id="qty-note" className={inputClass} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="For example: counted the shelf" />
        </div>
        {error && (
          <p role="alert" className="mb-4 rounded-lg border-2 border-bad-ink bg-bad-bg p-3 text-base font-semibold text-bad-ink">
            {error}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 sm:flex sm:justify-end">
          <Button onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={pending}>
            Update Stock
          </Button>
        </div>
      </form>
    </Modal>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import { adjustInventoryAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import type { AdjustAction, Product } from "@/types/inventory";

interface Props {
  products: Product[];
  initialProductId?: string;
  onClose: () => void;
  onSaved: (product: Product, newQuantity: number, updatedAt: string) => void;
}

const ACTIONS: { value: AdjustAction; label: string }[] = [
  { value: "add", label: "Add Stock" },
  { value: "remove", label: "Remove Stock" },
  { value: "set", label: "Set Quantity" },
];

/** The "Adjust Stock" form: pick a product, pick what to do, enter a number. */
export function AdjustStockModal({ products, initialProductId, onClose, onSaved }: Props) {
  const choices = useMemo(() => products.filter((p) => p.active), [products]);
  const [productId, setProductId] = useState(initialProductId ?? choices[0]?.id ?? "");
  const [action, setAction] = useState<AdjustAction>("add");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const product = choices.find((p) => p.id === productId);
  const qty = quantity.trim() === "" ? null : Number(quantity);
  const preview =
    product && qty !== null && Number.isInteger(qty) && qty >= 0
      ? action === "add" ? product.inventory + qty : action === "remove" ? product.inventory - qty : qty
      : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pending || !product) return;
    setError(null);
    start(async () => {
      const res = await adjustInventoryAction({ productId, action, quantity: qty ?? Number.NaN, note: note || undefined });
      if (res.ok) onSaved(product, res.newQuantity, res.updatedAt);
      else setError(res.error);
    });
  };

  return (
    <Modal title="Adjust Stock" onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <div className="mb-4">
          <label htmlFor="adjust-product" className="mb-1.5 block text-base font-semibold">
            Product
          </label>
          <select id="adjust-product" className={inputClass} value={productId} onChange={(e) => setProductId(e.target.value)}>
            {choices.map((p) => (
              <option key={p.id} value={p.id}>
                {p.product_name}
              </option>
            ))}
          </select>
          {product && <p className="mt-1 text-base">Current stock: <strong>{product.inventory}</strong></p>}
        </div>

        <fieldset className="mb-4">
          <legend className="mb-1.5 text-base font-semibold">Action</legend>
          <div className="flex flex-wrap gap-2">
            {ACTIONS.map((a) => (
              <label
                key={a.value}
                className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border-2 px-4 text-base font-semibold ${
                  action === a.value ? "border-accent bg-accent-soft" : "border-line bg-white"
                }`}
              >
                <input type="radio" name="action" value={a.value} checked={action === a.value} onChange={() => setAction(a.value)} className="size-5 accent-accent" />
                {a.label}
              </label>
            ))}
          </div>
        </fieldset>

        <Field label="Quantity" type="number" inputMode="numeric" min={0} step={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="10" />
        {preview !== null && (
          <p className="-mt-2 mb-4 text-base" aria-live="polite">
            {preview < 0 ? <strong className="text-bad-ink">That would take stock below zero.</strong> : <>New stock will be <strong>{preview}</strong></>}
          </p>
        )}
        <div className="mb-4">
          <label htmlFor="adjust-note" className="mb-1.5 block text-base font-semibold">
            Note (optional)
          </label>
          <input id="adjust-note" className={inputClass} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="New shipment" />
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
          <Button type="submit" variant="primary" loading={pending} disabled={!product}>
            Update Inventory
          </Button>
        </div>
      </form>
    </Modal>
  );
}

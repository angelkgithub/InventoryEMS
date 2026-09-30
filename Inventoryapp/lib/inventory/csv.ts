import type { Product } from "@/types/inventory";
import { getStatus, STATUS_LABEL } from "./status";

const cell = (v: string | number | null) => {
  const s = v === null ? "" : String(v);
  // Prefix formula-like text so spreadsheet apps never run it.
  const safe = /^[=+\-@]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function inventoryToCsv(products: Product[]): string {
  const header = ["Product", "SKU/NDC", "Category", "Stock", "Status", "Low stock alert at", "Archived", "Last updated"];
  const rows = products.map((p) => [
    p.product_name,
    p.sku,
    p.category ?? "Other",
    p.inventory,
    STATUS_LABEL[getStatus(p.inventory, p.low_stock_threshold)],
    p.low_stock_threshold,
    p.active ? "No" : "Yes",
    p.updated_at,
  ]);
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

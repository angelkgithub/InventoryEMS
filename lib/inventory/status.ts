import type { StockStatus } from "@/types/inventory";

export function getStatus(inventory: number, lowStockThreshold: number): StockStatus {
  if (inventory <= 0) return "out_of_stock";
  if (inventory <= lowStockThreshold) return "low_stock";
  return "in_stock";
}

export const STATUS_LABEL: Record<StockStatus, string> = {
  in_stock: "IN STOCK",
  low_stock: "LOW STOCK",
  out_of_stock: "OUT OF STOCK",
};

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

/** What employees (anonymous visitors) can see. No IDs, no history. */
export interface PublicProduct {
  product_name: string;
  sku: string | null;
  category: string | null;
  inventory: number;
  low_stock_threshold: number;
  updated_at: string;
}

/** Admin view of a product. */
export interface Product extends PublicProduct {
  id: string;
  active: boolean;
}

export type TransactionType = "stock_added" | "stock_removed" | "manual_adjustment" | "initial_stock";

export interface HistoryRow {
  id: string;
  previous_quantity: number;
  quantity_change: number;
  new_quantity: number;
  transaction_type: TransactionType;
  note: string | null;
  created_by_name: string | null;
  created_at: string;
  products: { product_name: string } | null;
}

export type AdjustAction = "add" | "remove" | "set";

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

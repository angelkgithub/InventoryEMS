import "server-only";
import { requireAdmin } from "@/lib/auth";
import type { Product } from "@/types/inventory";

/** All products (including archived) for the signed-in admin. RLS guarantees only admins get rows. */
export async function getAdminProducts(): Promise<Product[]> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("products")
    .select("id, product_name, sku, category, inventory, low_stock_threshold, active, updated_at")
    .order("product_name")
    .limit(5000);
  if (error) {
    console.error("getAdminProducts failed", error);
    throw new Error("Unable to load inventory.");
  }
  return (data ?? []) as Product[];
}

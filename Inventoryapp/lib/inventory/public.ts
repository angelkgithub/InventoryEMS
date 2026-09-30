import "server-only";
import { createPublicSupabase } from "@/lib/supabase/server";
import type { PublicProduct } from "@/types/inventory";

/** Employee-facing inventory: active products only, via the read-only `employee_inventory` view. */
export async function getPublicInventory(): Promise<{ items: PublicProduct[]; error: boolean }> {
  try {
    const { data, error } = await createPublicSupabase()
      .from("employee_inventory")
      .select("product_name, sku, category, inventory, low_stock_threshold, updated_at")
      .order("product_name")
      .limit(5000);
    if (error) throw error;
    return { items: (data ?? []) as PublicProduct[], error: false };
  } catch (e) {
    console.error("getPublicInventory failed", e);
    return { items: [], error: true };
  }
}

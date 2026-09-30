import type { Metadata } from "next";
import { InventoryManager } from "@/components/admin/inventory-manager";
import { getAdminProducts } from "@/lib/inventory/admin";

export const metadata: Metadata = { title: "Manage Inventory" };

export default async function AdminInventoryPage() {
  const products = await getAdminProducts();
  return <InventoryManager initialProducts={products} />;
}

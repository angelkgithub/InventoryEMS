import type { Metadata } from "next";
import { Greeting } from "@/components/admin/greeting";
import { InventoryManager } from "@/components/admin/inventory-manager";
import { getAdminProducts } from "@/lib/inventory/admin";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminDashboardPage() {
  const products = await getAdminProducts();
  return (
    <>
      <Greeting />
      <InventoryManager initialProducts={products} showSummary />
    </>
  );
}

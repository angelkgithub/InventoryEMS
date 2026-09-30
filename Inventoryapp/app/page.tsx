import Link from "next/link";
import { EmployeeInventory } from "@/components/inventory/employee-inventory";
import { getPublicInventory } from "@/lib/inventory/public";

// Always read fresh data from the database.
export const dynamic = "force-dynamic";

export default async function EmployeeInventoryPage() {
  const { items, error } = await getPublicInventory();

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-4xl font-bold tracking-tight">Inventory</h1>
        <p className="mt-1 text-xl text-muted">Check current product availability</p>
      </header>

      <main className="flex-1">
        <EmployeeInventory initialItems={items} initialError={error} />
      </main>

      <footer className="no-print mt-12 border-t border-line pt-4 text-base text-muted">
        <Link href="/admin" className="inline-block py-2 underline">
          Admin
        </Link>
      </footer>
    </div>
  );
}

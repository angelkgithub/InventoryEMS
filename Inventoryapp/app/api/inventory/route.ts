import { NextResponse } from "next/server";
import { getPublicInventory } from "@/lib/inventory/public";

// Public, read-only. Employees' pages poll this so stock changes show up without a reload.
export const dynamic = "force-dynamic";

export async function GET() {
  const { items, error } = await getPublicInventory();
  if (error) {
    return NextResponse.json({ error: "Inventory is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
}

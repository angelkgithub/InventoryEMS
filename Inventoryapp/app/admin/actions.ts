"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth";
import { createAdminSupabase } from "@/lib/supabase/server";
import { friendlyError, GENERIC_ERROR } from "@/lib/inventory/errors";
import {
  adjustSchema,
  archiveSchema,
  createProductSchema,
  firstIssue,
  updateProductSchema,
} from "@/lib/validation/inventory";
import type { ActionResult } from "@/types/inventory";

const NOT_SIGNED_IN = "Your session has expired. Please sign in again.";

function refreshPages() {
  revalidatePath("/");
  revalidatePath("/admin", "layout");
}

// ---- Sign in / out ----------------------------------------------------

export async function signInAction(_prev: { error?: string } | undefined, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Please enter your email and password." };

  const supabase = await createAdminSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Incorrect email or password." };

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) {
    await supabase.auth.signOut();
    return { error: "This account does not have admin access." };
  }
  redirect("/admin");
}

export async function signOutAction() {
  const supabase = await createAdminSupabase();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

// ---- Stock ------------------------------------------------------------

interface AdjustRpcResult {
  previous_quantity: number;
  quantity_change: number;
  new_quantity: number;
  updated_at: string;
}

export async function adjustInventoryAction(
  input: unknown,
): Promise<ActionResult<{ newQuantity: number; previousQuantity: number; updatedAt: string }>> {
  const parsed = adjustSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const admin = await getAdmin();
  if (!admin) return { ok: false, error: NOT_SIGNED_IN };

  // The database does the math (atomically, row-locked) and writes the history record.
  const { data, error } = await admin.supabase.rpc("adjust_inventory", {
    p_product_id: parsed.data.productId,
    p_action: parsed.data.action,
    p_quantity: parsed.data.quantity,
    p_note: parsed.data.note || null,
  });
  if (error) {
    if (!/STOCK_BELOW_ZERO|NO_CHANGE|INVALID_INPUT|PRODUCT_NOT_FOUND|NOT_AUTHORIZED/.test(error.message)) {
      console.error("adjust_inventory failed", error);
    }
    return { ok: false, error: friendlyError(error.message) };
  }
  const r = data as AdjustRpcResult;
  refreshPages();
  return { ok: true, newQuantity: r.new_quantity, previousQuantity: r.previous_quantity, updatedAt: r.updated_at };
}

// ---- Products ---------------------------------------------------------

export async function createProductAction(input: unknown): Promise<ActionResult> {
  const parsed = createProductSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const admin = await getAdmin();
  if (!admin) return { ok: false, error: NOT_SIGNED_IN };

  const { error } = await admin.supabase.rpc("create_product", {
    p_name: parsed.data.name,
    p_sku: parsed.data.sku ?? null,
    p_category: parsed.data.category ?? null,
    p_inventory: parsed.data.inventory,
    p_threshold: parsed.data.lowStockThreshold,
  });
  if (error) {
    console.error("create_product failed", error);
    return { ok: false, error: "Unable to add the product. Please try again." };
  }
  refreshPages();
  return { ok: true };
}

export async function updateProductAction(input: unknown): Promise<ActionResult> {
  const parsed = updateProductSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const admin = await getAdmin();
  if (!admin) return { ok: false, error: NOT_SIGNED_IN };

  // Note: `inventory` is not editable here. The database rejects it; use adjustInventoryAction.
  const { data, error } = await admin.supabase
    .from("products")
    .update({
      product_name: parsed.data.name,
      sku: parsed.data.sku || null,
      category: parsed.data.category || null,
      low_stock_threshold: parsed.data.lowStockThreshold,
    })
    .eq("id", parsed.data.productId)
    .select("id");
  if (error || !data?.length) {
    if (error) console.error("update product failed", error);
    return { ok: false, error: "Unable to save the product. Please try again." };
  }
  refreshPages();
  return { ok: true };
}

export async function setProductActiveAction(input: unknown): Promise<ActionResult> {
  const parsed = archiveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC_ERROR };

  const admin = await getAdmin();
  if (!admin) return { ok: false, error: NOT_SIGNED_IN };

  const { data, error } = await admin.supabase
    .from("products")
    .update({ active: parsed.data.active })
    .eq("id", parsed.data.productId)
    .select("id");
  if (error || !data?.length) {
    if (error) console.error("archive failed", error);
    return { ok: false, error: "Unable to change the product. Please try again." };
  }
  refreshPages();
  return { ok: true };
}

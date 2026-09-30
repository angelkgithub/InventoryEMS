import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createAdminSupabase } from "@/lib/supabase/server";

/**
 * Returns the signed-in admin, or null. Uses getUser(), which re-validates the
 * session with Supabase (cookies alone are never trusted) and then checks admin_users.
 */
export const getAdmin = cache(async () => {
  const supabase = await createAdminSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
  if (adminError || isAdmin !== true) return null;
  return { supabase, user: data.user };
});

/** For pages: send anyone who is not an admin to the login page. */
export async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

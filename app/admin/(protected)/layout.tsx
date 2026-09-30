import { AdminNav } from "@/components/admin/admin-nav";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Every page inside (protected) requires a signed-in admin.
export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAdmin();
  const name = (user.user_metadata?.name as string | undefined) ?? user.email ?? "Admin";
  return (
    <>
      <AdminNav name={name} />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </>
  );
}

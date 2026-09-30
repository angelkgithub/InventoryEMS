import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/login-form";
import { getAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Admin Sign In" };
export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await getAdmin()) redirect("/admin");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <h1 className="mb-1 text-3xl font-bold">Admin Sign In</h1>
      <p className="mb-6 text-lg text-muted">Sign in to manage inventory.</p>
      <LoginForm />
      <Link href="/" className="mt-6 inline-block py-2 text-base underline">
        Back to inventory
      </Link>
    </main>
  );
}

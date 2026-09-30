"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/history", label: "History" },
];

export function AdminNav({ name }: { name: string }) {
  const pathname = usePathname();
  const linkClass = "flex min-h-12 items-center justify-center rounded-lg px-3 text-center text-base font-semibold sm:px-4";
  return (
    <header className="no-print border-b border-line bg-card">
      <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xl font-bold">Inventory Admin</span>
          <div className="flex items-center gap-3">
            <span className="hidden max-w-56 truncate text-base text-muted lg:inline">{name}</span>
            <form action={signOutAction}>
              <Button type="submit">Sign Out</Button>
            </form>
          </div>
        </div>
        {/* Phones: four equal, thumb-sized buttons across the width. Larger screens: a simple row. */}
        <nav aria-label="Admin" className="mt-3 grid grid-cols-4 gap-1 sm:flex sm:flex-wrap">
          {LINKS.map((l) => {
            const current = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={current ? "page" : undefined}
                className={`${linkClass} ${current ? "bg-accent-soft text-accent-dark underline underline-offset-4" : "hover:bg-page"}`}
              >
                {l.label}
              </Link>
            );
          })}
          <Link href="/" className={`${linkClass} hover:bg-page`}>
            Employee View
          </Link>
        </nav>
      </div>
    </header>
  );
}

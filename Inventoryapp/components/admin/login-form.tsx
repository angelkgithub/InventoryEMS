"use client";

import { useActionState } from "react";
import { signInAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

export function LoginForm() {
  const [state, action, pending] = useActionState(signInAction, undefined);
  return (
    <form action={action} className="rounded-xl border border-line bg-card p-6 shadow-sm">
      <Field label="Email" name="email" type="email" autoComplete="username" required autoFocus />
      <Field label="Password" name="password" type="password" autoComplete="current-password" required />
      {state?.error && (
        <p role="alert" className="mb-4 rounded-lg border-2 border-bad-ink bg-bad-bg p-3 text-base font-semibold text-bad-ink">
          {state.error}
        </p>
      )}
      <Button type="submit" variant="primary" loading={pending} loadingText="Signing in..." className="w-full">
        Sign In
      </Button>
    </form>
  );
}

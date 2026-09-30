"use client";

import { Button } from "@/components/ui/button";

// Friendly fallback: never shows technical details to the user.
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 text-center">
      <h1 className="mb-2 text-3xl font-bold">Something went wrong</h1>
      <p className="mb-6 text-lg text-muted">Please try again. If it keeps happening, let your administrator know.</p>
      <Button variant="primary" onClick={reset} className="mx-auto">
        Try Again
      </Button>
    </main>
  );
}

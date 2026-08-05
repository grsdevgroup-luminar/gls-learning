"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw } from "lucide-react";

/** Shared body for every route segment's error.tsx. Next.js requires error.tsx
 *  itself to be a Client Component, but the actual UI is identical everywhere
 *  except the "go back" destination, so that's the only thing callers vary. */
export function RouteError({
  error,
  reset,
  homeHref = "/",
  homeLabel = "Go home",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  homeHref?: string;
  homeLabel?: string;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" />
      </div>
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        {error.message || "An unexpected error occurred. Please try again."}
      </p>
      <div className="mt-2 flex items-center gap-3">
        <Button onClick={reset} variant="outline">
          <RotateCcw /> Try again
        </Button>
        <Button render={<Link href={homeHref} />}>{homeLabel}</Button>
      </div>
    </div>
  );
}

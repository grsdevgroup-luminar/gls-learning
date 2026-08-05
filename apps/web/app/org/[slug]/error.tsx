"use client";

import { RouteError } from "@/components/shared/route-error";

export default function OrgError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // No route params in error.tsx, so this can't link back to the specific
  // org slug — falls back to the site root instead of guessing a URL.
  return <RouteError {...props} homeHref="/" homeLabel="Go home" />;
}

"use client";

import { RouteError } from "@/components/shared/route-error";

export default function StorefrontError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} homeHref="/" homeLabel="Go home" />;
}

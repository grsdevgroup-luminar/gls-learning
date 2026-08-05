"use client";

import { RouteError } from "@/components/shared/route-error";

export default function StudentError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} homeHref="/dashboard" homeLabel="Go to dashboard" />;
}

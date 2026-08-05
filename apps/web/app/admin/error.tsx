"use client";

import { RouteError } from "@/components/shared/route-error";

export default function AdminError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} homeHref="/admin" homeLabel="Go to admin overview" />;
}

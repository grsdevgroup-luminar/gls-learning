"use client";

import { RouteError } from "@/components/shared/route-error";

export default function SalesAgentError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} homeHref="/sales-agent" homeLabel="Go to agent dashboard" />;
}

"use client";

import { RouteError } from "@/components/shared/route-error";

export default function DeliveryPartnerError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} homeHref="/delivery-partner" homeLabel="Go to partner dashboard" />;
}

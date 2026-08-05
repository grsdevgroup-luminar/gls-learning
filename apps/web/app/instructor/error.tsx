"use client";

import { RouteError } from "@/components/shared/route-error";

export default function InstructorError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} homeHref="/instructor" homeLabel="Go to instructor dashboard" />;
}

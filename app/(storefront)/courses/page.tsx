import { Suspense } from "react";
import { CatalogClient } from "@/components/storefront/catalog-client";

export default function CoursesPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-16">Loading courses…</div>}>
      <CatalogClient />
    </Suspense>
  );
}

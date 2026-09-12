import type { Metadata } from "next";
import { Suspense } from "react";
import ReviewsClient from "./page-client";

export const metadata: Metadata = { title: "Reviews" };

export default function ReviewsPage() {
  return (
    <Suspense>
      <ReviewsClient />
    </Suspense>
  );
}

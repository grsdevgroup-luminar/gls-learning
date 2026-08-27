import type { Metadata } from "next";
import ReviewsClient from "./page-client";

export const metadata: Metadata = { title: "Reviews" };

export default function ReviewsPage() {
  return <ReviewsClient />;
}

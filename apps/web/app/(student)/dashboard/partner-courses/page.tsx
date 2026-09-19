import type { Metadata } from "next";
import PartnerCoursesClient from "./page-client";

export const metadata: Metadata = { title: "Partner courses" };

export default function PartnerCoursesPage() {
  return <PartnerCoursesClient />;
}

import type { Metadata } from "next";
import PartnerCoursesClient from "./page-client";

export const metadata: Metadata = { title: "Delivery partner courses" };

export default function DeliveryPartnerCoursesPage() {
  return <PartnerCoursesClient />;
}

import type { Metadata } from "next";
import DeliveryPartnersClient from "./page-client";

export const metadata: Metadata = { title: "Delivery partners" };

export default function DeliveryPartnersPage() {
  return <DeliveryPartnersClient />;
}

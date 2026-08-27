import type { Metadata } from "next";
import OrdersClient from "./page-client";

export const metadata: Metadata = { title: "Orders" };

export default function OrdersPage() {
  return <OrdersClient />;
}

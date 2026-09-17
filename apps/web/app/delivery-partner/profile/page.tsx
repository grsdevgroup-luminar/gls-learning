import type { Metadata } from "next";
import SalesProfileClient from "./page-client";

export const metadata: Metadata = { title: "Delivery partner profile" };

export default function SalesProfilePage() {
  return <SalesProfileClient />;
}

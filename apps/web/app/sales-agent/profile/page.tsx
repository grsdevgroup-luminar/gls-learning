import type { Metadata } from "next";
import SalesProfileClient from "./page-client";

export const metadata: Metadata = { title: "Sales agent profile" };

export default function SalesProfilePage() {
  return <SalesProfileClient />;
}

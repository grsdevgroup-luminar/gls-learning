import type { Metadata } from "next";
import OrganizationsClient from "./page-client";

export const metadata: Metadata = { title: "Organizations" };

export default function OrganizationsPage() {
  return <OrganizationsClient />;
}

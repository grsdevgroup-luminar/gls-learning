import type { Metadata } from "next";
import OrgAccountClient from "./page-client";

export const metadata: Metadata = { title: "Organization account" };

export default function OrganizationAccountPage() {
  return <OrgAccountClient />;
}

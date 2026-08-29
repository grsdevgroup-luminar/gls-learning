import type { Metadata } from "next";
import OrgMembersClient from "./page-client";

export const metadata: Metadata = { title: "Organization members" };

export default function OrganizationMembersPage() {
  return <OrgMembersClient />;
}

import type { Metadata } from "next";
import OrgCoursesClient from "./page-client";

export const metadata: Metadata = { title: "Organization courses" };

export default function OrganizationCoursesPage() {
  return <OrgCoursesClient />;
}

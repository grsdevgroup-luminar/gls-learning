import { redirect } from "next/navigation";
import type { OrganizationDto } from "@skillstream/shared";
import { serverApiOptional } from "@/lib/api/server";

/** Resolve the organization portal entry point for an authenticated org user. */
export default async function OrganizationEntryPage() {
  const organizations = await serverApiOptional<OrganizationDto[]>(
    "/me/organizations",
  );
  const organization = organizations?.[0];

  if (organization) redirect(`/org/${organization.slug}`);

  // Avoid leaving an org account at a dead /org URL if its membership was
  // removed or has not been provisioned yet.
  redirect("/dashboard");
}

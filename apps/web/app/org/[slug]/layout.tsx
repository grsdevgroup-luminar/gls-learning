import type { Metadata } from "next";
import { PortalShell, type NavItem } from "@/components/shared/portal-shell";
import { serverApiOptional } from "@/lib/api/server";
import { initials } from "@/lib/format";
import type { AuthUserDto, OrganizationDto } from "@skillstream/shared";

export const metadata: Metadata = {
  title: "Organization Portal",
};

// Server Component — the org lookup only needs the route param, which a
// Server Component receives directly (no useParams() needed), so this never
// had to be client-rendered in the first place.
export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [org, user] = await Promise.all([
    serverApiOptional<OrganizationDto>(`/organizations/${slug}`),
    serverApiOptional<AuthUserDto>("/auth/me"),
  ]);

  const name = org?.name ?? "Organization";
  const email = org?.adminEmail ?? "";

  const items: NavItem[] = [
    { href: `/org/${slug}`, label: "Overview", icon: "LayoutDashboard", exact: true },
    { href: `/org/${slug}/courses`, label: "Courses", icon: "BookOpen" },
    { href: `/org/${slug}/members`, label: "Members", icon: "Users" },
    { href: `/org/${slug}/account`, label: "Account", icon: "Settings" },
  ];

  return (
    <PortalShell items={items} badge="Company Admin" user={{ name, email, initials: initials(name), avatar: user?.avatar ?? null }}>
      {children}
    </PortalShell>
  );
}

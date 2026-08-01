"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { PortalShell, type NavItem } from "@/components/shared/portal-shell";
import { apiFetch } from "@/lib/api/client";
import type { OrganizationDto } from "@skillstream/shared";
import { LayoutDashboard, BookOpen, Users, Settings } from "lucide-react";

export default function OrgLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const { data: org } = useQuery<OrganizationDto>({
    queryKey: ["org", slug],
    queryFn: () => apiFetch(`/organizations/${slug}`),
    enabled: !!slug,
  });

  const name = org?.name ?? "Organization";
  const email = org?.adminEmail ?? "";
  const abbrev = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const items: NavItem[] = [
    { href: `/org/${slug}`, label: "Overview", icon: LayoutDashboard, exact: true },
    { href: `/org/${slug}/courses`, label: "Courses", icon: BookOpen },
    { href: `/org/${slug}/members`, label: "Members", icon: Users },
    { href: `/org/${slug}/account`, label: "Account", icon: Settings },
  ];

  return (
    <PortalShell items={items} badge="Company Admin" user={{ name, email, initials: abbrev }}>
      {children}
    </PortalShell>
  );
}

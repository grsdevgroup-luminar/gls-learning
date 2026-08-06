import type { AuthUserDto } from "@skillstream/shared";
import { PortalShell, type NavItem } from "@/components/shared/portal-shell";
import { serverApiOptional } from "@/lib/api/server";
import { initials } from "@/lib/format";

const items: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard", exact: true },
  { href: "/dashboard/progress", label: "My progress", icon: "BarChart3" },
  { href: "/dashboard/team", label: "Team courses", icon: "Building2" },
  { href: "/dashboard/certificates", label: "Certificates", icon: "Award" },
  { href: "/dashboard/billing", label: "Billing", icon: "Receipt" },
  { href: "/account", label: "Account", icon: "Settings" },
];

// Server Component: only PortalShell's nav chrome needs to be a client
// boundary (active-link highlighting, mobile sheet, logout dropdown) — the
// viewer's name/email for the sidebar comes from a server-side session read
// (same cookie-forwarding serverApi pattern as the home page), instead of
// requiring this whole layout to be client-rendered just for useSession().
export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await serverApiOptional<AuthUserDto>("/auth/me");
  const name = user?.name ?? "Student";
  const email = user?.email ?? "";
  return (
    <PortalShell
      items={items}
      badge="Student"
      user={{ name, email, initials: initials(name) }}
    >
      {children}
    </PortalShell>
  );
}

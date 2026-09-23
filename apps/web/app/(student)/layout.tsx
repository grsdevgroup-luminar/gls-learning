import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { AuthUserDto } from "@skillstream/shared";
import { PortalShell, type NavItem } from "@/components/shared/portal-shell";
import { serverApiOptional } from "@/lib/api/server";
import { initials } from "@/lib/format";

export const metadata: Metadata = {
  title: "Student Portal",
};

const items: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard", exact: true },
  { href: "/dashboard/progress", label: "My progress", icon: "BarChart3" },
  { href: "/dashboard/team", label: "Team courses", icon: "Building2" },
  { href: "/dashboard/partner-courses", label: "Partner courses", icon: "Handshake" },
  { href: "/dashboard/certificates", label: "Certificates", icon: "Award" },
  { href: "/dashboard/billing", label: "Billing", icon: "Receipt" },
  { href: "/dashboard/credits", label: "Store credit", icon: "Wallet" },
  { href: "/account", label: "Account", icon: "Settings" },
];

// Server Component: only PortalShell's nav chrome needs to be a client
// boundary (active-link highlighting, mobile sheet, logout dropdown) — the
// viewer's name/email for the sidebar comes from a server-side session read
// (same cookie-forwarding serverApi pattern as the home page), instead of
// requiring this whole layout to be client-rendered just for useSession().
export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await serverApiOptional<AuthUserDto>("/auth/me");
  // A pending delivery-partner application keeps `role: STUDENT` (see
  // DELIVERY_PARTNER_MEMBER_FLOW_PLAN.md §2.1), so it would otherwise pass
  // straight through to the full student portal on direct navigation — a
  // delivery-partner applicant isn't a student, so send them to their
  // application-status page instead. A rejected applicant is deliberately
  // excluded here: per plan §2.4 they go through support and continue as a
  // normal student, so they keep full dashboard access.
  if (user?.deliveryPartnerStatus === "PENDING") {
    redirect("/delivery-partner");
  }
  // Org admins have their own portal — keep them out of the student shell
  // (proxy.ts also redirects /dashboard, but this catches /account too).
  if (user?.role === "ORG_ADMIN") {
    redirect("/org");
  }
  const name = user?.name ?? "Student";
  const email = user?.email ?? "";
  return (
    <PortalShell
      items={items}
      badge="Student"
      user={{ name, email, initials: initials(name), avatar: user?.avatar ?? null }}
    >
      {children}
    </PortalShell>
  );
}

import type { Metadata } from "next";
import type { AuthUserDto, InstructorApplicationStatsDto } from "@skillstream/shared";
import { PortalShell, type NavItem } from "@/components/shared/portal-shell";
import { serverApiOptional } from "@/lib/api/server";
import { initials } from "@/lib/format";

export const metadata: Metadata = {
  title: "Admin dashboard",
};

// Server Component — see app/(student)/layout.tsx for why.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, applicationStats] = await Promise.all([
    serverApiOptional<AuthUserDto>("/auth/me"),
    serverApiOptional<InstructorApplicationStatsDto>("/admin/instructor-applications/stats"),
  ]);
  const name = user?.name ?? "Admin";
  const email = user?.email ?? "";

  const items: NavItem[] = [
    { href: "/admin", label: "Overview", icon: "LayoutDashboard", exact: true },
    { href: "/admin/courses", label: "Courses", icon: "BookOpen" },
    {
      href: "/admin/instructors",
      label: "Instructors",
      icon: "GraduationCap",
      badgeCount: applicationStats?.pending,
    },
    { href: "/admin/agents", label: "Sales Agents", icon: "UserCheck" },
    { href: "/admin/payouts", label: "Payouts", icon: "Wallet" },
    { href: "/admin/organizations", label: "Organizations", icon: "Building2" },
    { href: "/admin/students", label: "Students", icon: "Users" },
    { href: "/admin/orders", label: "Orders", icon: "ShoppingBag" },
    { href: "/admin/coupons", label: "Coupons", icon: "Ticket" },
    { href: "/admin/pricing", label: "Pricing", icon: "Globe2" },
    { href: "/admin/reviews", label: "Reviews", icon: "Star" },
    { href: "/admin/marketing", label: "Automation", icon: "Megaphone" },
    { href: "/admin/settings", label: "Settings", icon: "Settings" },
  ];

  return (
    <PortalShell
      items={items}
      badge="Admin"
      user={{ name, email, initials: initials(name), avatar: user?.avatar ?? null }}
    >
      {children}
    </PortalShell>
  );
}

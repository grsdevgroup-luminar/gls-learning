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
    { href: "/admin", label: "Overview", icon: "LayoutDashboard", exact: true, searchKeywords: ["dashboard", "home", "analytics", "summary"] },
    { href: "/admin/courses", label: "Courses", icon: "BookOpen", searchKeywords: ["course management", "course catalog", "lessons", "content"] },
    {
      href: "/admin/instructors",
      label: "Instructors",
      icon: "GraduationCap",
      badgeCount: applicationStats?.pending,
      searchKeywords: ["instructor management", "applications", "approval", "teachers"],
    },
    { href: "/admin/agents", label: "Sales Agents", icon: "UserCheck", searchKeywords: ["sales management", "applications", "referrals", "agents"] },
    { href: "/admin/payouts", label: "Payouts", icon: "Wallet", searchKeywords: ["payments", "withdrawals", "earnings", "finance"] },
    { href: "/admin/organizations", label: "Organizations", icon: "Building2", searchKeywords: ["companies", "teams", "company management", "members"] },
    { href: "/admin/students", label: "Students", icon: "Users", searchKeywords: ["student management", "learners", "users", "profiles"] },
    { href: "/admin/orders", label: "Orders", icon: "ShoppingBag", searchKeywords: ["purchases", "transactions", "sales"] },
    { href: "/admin/coupons", label: "Coupons", icon: "Ticket", searchKeywords: ["discounts", "promo codes", "promotions", "offers"] },
    { href: "/admin/pricing", label: "Pricing", icon: "Globe2", searchKeywords: ["regional pricing", "currencies", "exchange rates", "regions"] },
    { href: "/admin/reviews", label: "Reviews", icon: "Star", searchKeywords: ["review moderation", "review management", "ratings", "feedback", "approval"] },
    { href: "/admin/marketing", label: "Automation", icon: "Megaphone", searchKeywords: ["marketing", "notifications", "campaigns", "rules"] },
    { href: "/admin/settings", label: "Settings", icon: "Settings", searchKeywords: ["configuration", "preferences", "system"] },
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

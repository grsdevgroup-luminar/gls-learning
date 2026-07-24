"use client";

import { PortalShell, type NavItem } from "@/components/shared/portal-shell";
import { useSession } from "@/lib/api/session";
import { initials } from "@/lib/format";
import {
  LayoutDashboard, BookOpen, Users, ShoppingBag, Ticket, Globe2,
  Star, Megaphone, Settings, GraduationCap, UserCheck, Building2, Wallet,
} from "lucide-react";

const items: NavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/courses", label: "Courses", icon: BookOpen },
  { href: "/admin/instructors", label: "Instructors", icon: GraduationCap },
  { href: "/admin/agents", label: "Sales Agents", icon: UserCheck },
  { href: "/admin/payouts", label: "Payouts", icon: Wallet },
  { href: "/admin/organizations", label: "Organizations", icon: Building2 },
  { href: "/admin/students", label: "Students", icon: Users },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/coupons", label: "Coupons", icon: Ticket },
  { href: "/admin/pricing", label: "Pricing", icon: Globe2 },
  { href: "/admin/reviews", label: "Reviews", icon: Star },
  { href: "/admin/marketing", label: "Automation", icon: Megaphone },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  const name = user?.name ?? "Admin";
  const email = user?.email ?? "";
  return (
    <PortalShell
      items={items}
      badge="Admin"
      user={{ name, email, initials: initials(name) }}
    >
      {children}
    </PortalShell>
  );
}

"use client";

import { PortalShell, type NavItem } from "@/components/shared/portal-shell";
import { useSession } from "@/lib/api/session";
import { initials } from "@/lib/format";
import { LayoutDashboard, BarChart3, Award, Receipt, Settings, Building2 } from "lucide-react";

const items: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/progress", label: "My progress", icon: BarChart3 },
  { href: "/dashboard/team", label: "Team courses", icon: Building2 },
  { href: "/dashboard/certificates", label: "Certificates", icon: Award },
  { href: "/dashboard/billing", label: "Billing", icon: Receipt },
  { href: "/account", label: "Account", icon: Settings },
];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
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

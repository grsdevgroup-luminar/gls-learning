"use client";

import { PortalShell, type NavItem } from "@/components/shared/portal-shell";
import { demoStudent } from "@/lib/mock/students";
import { initials } from "@/lib/format";
import { LayoutDashboard, BarChart3, Award, Receipt, Settings } from "lucide-react";

const items: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/progress", label: "My progress", icon: BarChart3 },
  { href: "/dashboard/certificates", label: "Certificates", icon: Award },
  { href: "/dashboard/billing", label: "Billing", icon: Receipt },
  { href: "/account", label: "Account", icon: Settings },
];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell
      items={items}
      badge="Student"
      user={{ name: demoStudent.name, email: demoStudent.email, initials: initials(demoStudent.name) }}
    >
      {children}
    </PortalShell>
  );
}

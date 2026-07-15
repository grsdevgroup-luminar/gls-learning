"use client";

import { PortalShell, type NavItem } from "@/components/shared/portal-shell";
import { useSession } from "@/lib/api/session";
import {
  LayoutDashboard,
  Link2,
  DollarSign,
  UserCog,
} from "lucide-react";

const items: NavItem[] = [
  { href: "/sales-agent", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/sales-agent/referrals", label: "Referrals", icon: Link2 },
  { href: "/sales-agent/earnings", label: "Earnings", icon: DollarSign },
  { href: "/sales-agent/profile", label: "Profile", icon: UserCog },
];

export default function SalesAgentLayout({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  const name = user?.name ?? "Agent";
  const email = user?.email ?? "";
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <PortalShell
      items={items}
      badge="Sales Agent"
      user={{ name, email, initials }}
    >
      {children}
    </PortalShell>
  );
}

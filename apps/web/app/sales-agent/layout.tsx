import Link from "next/link";
import type { AuthUserDto } from "@skillstream/shared";
import { PortalShell, type NavItem } from "@/components/shared/portal-shell";
import { serverApiOptional } from "@/lib/api/server";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/format";
import { Megaphone } from "lucide-react";

const items: NavItem[] = [
  { href: "/sales-agent", label: "Overview", icon: "LayoutDashboard", exact: true },
  { href: "/sales-agent/referrals", label: "Referrals", icon: "Link2" },
  { href: "/sales-agent/earnings", label: "Earnings", icon: "DollarSign" },
  { href: "/sales-agent/profile", label: "Profile", icon: "UserCog" },
];

// Server Component — see app/(student)/layout.tsx for why.
export default async function SalesAgentLayout({ children }: { children: React.ReactNode }) {
  const user = await serverApiOptional<AuthUserDto>("/auth/me");

  if (!user) {
    return (
      <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4 py-12 text-center">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <span className="icon-tile mx-auto mb-5 grid size-14 place-items-center" style={{ ["--tile" as string]: "var(--tint-emerald)" }}>
          <Megaphone className="size-7" />
        </span>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Sales agent program</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to apply as a sales agent and start earning commission on referrals.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button render={<Link href="/login?next=/sales-agent" />} size="lg">Log in</Button>
          <Button render={<Link href="/signup?next=/sales-agent" />} size="lg" variant="outline">Create an account</Button>
        </div>
      </div>
    );
  }

  const name = user.name;
  const email = user.email;

  return (
    <PortalShell
      items={items}
      badge="Sales Agent"
      user={{ name, email, initials: initials(name) }}
    >
      {children}
    </PortalShell>
  );
}

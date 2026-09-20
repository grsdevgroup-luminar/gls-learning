import Link from "next/link";
import type { Metadata } from "next";
import type { AuthUserDto, DeliveryPartnerDto } from "@skillstream/shared";
import { PortalShell, type NavItem } from "@/components/shared/portal-shell";
import { serverApiOptional } from "@/lib/api/server";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/format";
import { Handshake } from "lucide-react";

export const metadata: Metadata = {
  title: "Delivery partner dashboard",
};

const items: NavItem[] = [
  { href: "/delivery-partner", label: "Overview", icon: "LayoutDashboard", exact: true },
  { href: "/delivery-partner/courses", label: "Courses", icon: "BookOpen" },
  { href: "/delivery-partner/referrals", label: "Referrals", icon: "Link2" },
  { href: "/delivery-partner/earnings", label: "Earnings", icon: "DollarSign" },
  { href: "/delivery-partner/profile", label: "Profile", icon: "UserCog" },
];

// Server Component — see app/(student)/layout.tsx for why.
export default async function DeliveryPartnerLayout({ children }: { children: React.ReactNode }) {
  const user = await serverApiOptional<AuthUserDto>("/auth/me");

  if (!user) {
    return (
      <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4 py-12 text-center">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <span className="icon-tile mx-auto mb-5 grid size-14 place-items-center" style={{ ["--tile" as string]: "var(--tint-emerald)" }}>
          <Handshake className="size-7" />
        </span>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Delivery partner program</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Apply to become a delivery partner and start earning commission on referrals.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button render={<Link href="/partner" />} size="lg">Apply now</Button>
        </div>
      </div>
    );
  }

  const name = user.name;
  const email = user.email;

  // Every nav destination gates identically until approved (each sub-page
  // shows the same not-applied/pending/rejected/suspended notice), so a full
  // sidebar just dresses up dead links as a working app — same fix as
  // app/instructor/layout.tsx. Collapse it to an empty nav until approved.
  const partner = await serverApiOptional<DeliveryPartnerDto>("/me/delivery-partner");
  const approved = partner?.status === "APPROVED";

  return (
    <PortalShell
      items={approved ? items : []}
      badge="Delivery Partner"
      user={{ name, email, initials: initials(name), avatar: user.avatar ?? null }}
    >
      {children}
    </PortalShell>
  );
}

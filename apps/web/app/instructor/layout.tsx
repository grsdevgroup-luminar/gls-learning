import Link from "next/link";
import type { Metadata } from "next";
import type { AuthUserDto, InstructorProfileDto } from "@skillstream/shared";
import { serverApiOptional } from "@/lib/api/server";
import { PortalShell, type NavItem } from "@/components/shared/portal-shell";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/format";
import { GraduationCap } from "lucide-react";

export const metadata: Metadata = {
  title: "Instructor dashboard",
};

const items: NavItem[] = [
  { href: "/instructor", label: "Overview", icon: "LayoutDashboard", exact: true },
  { href: "/instructor/courses", label: "My Courses", icon: "BookOpen" },
  { href: "/instructor/earnings", label: "Earnings", icon: "BarChart3" },
  { href: "/instructor/profile", label: "Profile", icon: "UserCog" },
];

// Server Component — see app/(student)/layout.tsx for why. Gated on session
// only, not role: this portal also hosts the apply form and application
// status (pending/rejected) for accounts that aren't INSTRUCTOR yet — same
// pattern as app/delivery-partner/layout.tsx. page.tsx and ApprovalGate render
// the right view for whatever the viewer's actual application status is.
export default async function InstructorLayout({ children }: { children: React.ReactNode }) {
  const user = await serverApiOptional<AuthUserDto>("/auth/me");

  if (!user) {
    return (
      <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4 py-12 text-center">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <span className="icon-tile mx-auto mb-5 grid size-14 place-items-center" style={{ ["--tile" as string]: "var(--tint-violet)" }}>
          <GraduationCap className="size-7" />
        </span>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Instructor area</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to your instructor account, or apply to teach on GRS Learning.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button render={<Link href="/login?next=/instructor" />} size="lg">Log in as instructor</Button>
          <Button render={<Link href="/teach" />} size="lg" variant="outline">Become an instructor</Button>
        </div>
      </div>
    );
  }

  // Every nav destination gates identically until approved (ApprovalGate
  // shows the same not-applied/pending/rejected notice everywhere), so a full
  // sidebar just dresses up four dead links as a working app. Collapse it to
  // an empty nav until approval — same chrome, no links that go nowhere.
  const profile = await serverApiOptional<InstructorProfileDto>("/me/instructor");
  const approved = profile?.status === "APPROVED";

  return (
    <PortalShell
      items={approved ? items : []}
      badge="Instructor"
      showBackToSite={false}
      user={{
        name: user.name,
        email: user.email,
        initials: initials(user.name),
        avatar: user.avatar ?? null,
      }}
    >
      {children}
    </PortalShell>
  );
}

import Link from "next/link";
import type { AuthUserDto } from "@skillstream/shared";
import { serverApiOptional } from "@/lib/api/server";
import { PortalShell, type NavItem } from "@/components/shared/portal-shell";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/format";
import { GraduationCap } from "lucide-react";

const items: NavItem[] = [
  { href: "/instructor", label: "Overview", icon: "LayoutDashboard", exact: true },
  { href: "/instructor/courses", label: "My Courses", icon: "BookOpen" },
  { href: "/instructor/earnings", label: "Earnings", icon: "BarChart3" },
  { href: "/instructor/profile", label: "Profile", icon: "UserCog" },
];

// Server Component — see app/(student)/layout.tsx for why. The role gate
// below now runs against a server-fetched session, so there's no client-side
// loading flash before it decides what to render.
export default async function InstructorLayout({ children }: { children: React.ReactNode }) {
  const user = await serverApiOptional<AuthUserDto>("/auth/me");

  if (!user || (user.role !== "INSTRUCTOR" && user.role !== "ADMIN")) {
    return (
      <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4 py-12 text-center">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <span className="icon-tile mx-auto mb-5 grid size-14 place-items-center" style={{ ["--tile" as string]: "var(--tint-violet)" }}>
          <GraduationCap className="size-7" />
        </span>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Instructor area</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {user
            ? "Your account isn't an instructor yet. Apply to teach — once you're approved this area unlocks automatically."
            : "Sign in to your instructor account, or apply to teach on SkillStream."}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          {!user && <Button render={<Link href="/login?next=/instructor" />} size="lg">Log in as instructor</Button>}
          <Button render={<Link href="/teach" />} size="lg" variant="outline">Become an instructor</Button>
        </div>
      </div>
    );
  }

  return (
    <PortalShell
      items={items}
      badge="Instructor"
      user={{
        name: user.name,
        email: user.email,
        initials: initials(user.name),
      }}
    >
      {children}
    </PortalShell>
  );
}

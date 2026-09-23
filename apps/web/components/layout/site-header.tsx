"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Logo } from "@/components/shared/logo";
import { NotificationBell } from "@/components/shared/notification-bell";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useStore } from "@/lib/context/store";
import { useSession, useLogout } from "@/lib/api/session";
import { initials } from "@/lib/format";
import { useDebouncedSearch } from "@/lib/use-debounced-value";
import {
  activeCourseSearchQuery,
  shouldPreserveSearchInputOverUrlSync,
} from "@/lib/course-search";
import { toast } from "sonner";
import {
  ShoppingCart,
  Search,
  LayoutDashboard,
  GraduationCap,
  User,
  LogOut,
  Shield,
  PenSquare,
  Megaphone,
  Users,
  Building2,
} from "lucide-react";

export function SiteHeader() {
  const { cart, mounted } = useStore();
  const { user, role, isLoading } = useSession();
  const logoutMut = useLogout();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQ = pathname === "/courses" ? (searchParams.get("q") ?? "") : "";
  const [q, setQ] = useState(urlQ);
  const [syncedQ, setSyncedQ] = useState(urlQ);
  const debouncedQ = useDebouncedSearch(q);
  // Tracks URL changes initiated by this input, so a stale debounced value
  // cannot overwrite a newer value the user has already typed.
  const pendingUrlQRef = useRef<string | null>(null);
  const isAuthed = !!user;
  const isInstructor = !isLoading && role === "INSTRUCTOR";

  const pushSearchToUrl = useCallback(
    (query: string) => {
      const normalized = activeCourseSearchQuery(query);
      if (pathname === "/courses") {
        const nextParams = new URLSearchParams(searchParams.toString());
        if (!normalized) nextParams.delete("q");
        else nextParams.set("q", normalized);

        const nextQueryString = nextParams.toString();
        const nextHref = nextQueryString
          ? `/courses?${nextQueryString}`
          : "/courses";
        const currentQueryString = searchParams.toString();
        const currentHref = currentQueryString
          ? `/courses?${currentQueryString}`
          : "/courses";
        if (nextHref === currentHref) return;

        pendingUrlQRef.current = normalized;
        router.push(nextHref);
        return;
      }

      if (!normalized) return;

      pendingUrlQRef.current = normalized;
      router.push(`/courses?q=${encodeURIComponent(normalized)}`);
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    if (syncedQ !== urlQ) {
      const pending = pendingUrlQRef.current;
      pendingUrlQRef.current = null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mirror navigation state into the controlled search input
      setSyncedQ(urlQ);
      if (pending !== null && urlQ === pending) {
        setQ((current) =>
          shouldPreserveSearchInputOverUrlSync(current, urlQ, pending)
            ? current
            : urlQ,
        );
      } else {
        // Back/Forward or navigation from elsewhere: reflect the URL.
        setQ(urlQ);
      }
      // Do not replay the stale debounced value from the render that observed
      // this URL change.
      return;
    }

    // Avoid pushing an intermediate value while the user is still typing.
    if (debouncedQ !== q.trim()) return;
    pushSearchToUrl(debouncedQ);
  }, [debouncedQ, q, pushSearchToUrl, syncedQ, urlQ]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    pushSearchToUrl(q);
  }

  async function logout() {
    // Do NOT call clearCart() here — the server cart persists across logout
    // (the whole point of the DB cart). The store's user-change effect resets
    // in-memory cart to the (empty) guest cart automatically.
    await logoutMut.mutateAsync();
    toast.success("Signed out");
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/55">
      {/* aurora hairline under the header */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,color-mix(in_oklch,var(--aurora-2)_60%,transparent),color-mix(in_oklch,var(--aurora-3)_50%,transparent),transparent)] opacity-60"
      />
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex">
          {!isInstructor && (
            <Button render={<Link href="/courses" />} variant="ghost" size="sm">
              Courses
            </Button>
          )}
          {!isLoading && (!isAuthed || role === "INSTRUCTOR") && (
            <Button
              render={
                <Link href={role === "INSTRUCTOR" ? "/instructor" : "/teach"} />
              }
              variant="ghost"
              size="sm"
            >
              {role === "INSTRUCTOR" ? "Instructor" : "Teach"}
            </Button>
          )}
        </nav>

        <form
          onSubmit={submitSearch}
          className="relative ml-2 hidden flex-1 lg:block"
        >
          <button
            type="submit"
            aria-label="Search courses"
            className="absolute left-0 top-0 z-10 flex h-8 w-9 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <Search className="h-4 w-4" />
          </button>
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search for courses, topics, skills…"
            className="search-input border-input bg-background pl-9 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 dark:bg-input/30"
            minLength={2}
          />
        </form>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden items-center gap-0.5 rounded-full border border-border bg-muted/40 p-1 sm:flex">
            <ThemeToggle size="icon-sm" className="rounded-full" />
            {isAuthed && (
              <>
                <span aria-hidden className="h-4 w-px bg-border" />
                <NotificationBell />
              </>
            )}
            <span aria-hidden className="h-4 w-px bg-border" />
            {!isInstructor && (
              <Button
                render={<Link href="/cart" />}
                variant="ghost"
                size="icon-sm"
                className="relative rounded-full"
                aria-label="Cart"
              >
                <ShoppingCart className="h-4 w-4" />
                {mounted && cart.length > 0 && (
                  <Badge className="absolute -right-1 -top-1 h-5 min-w-5 justify-center rounded-full px-1 text-[10px]">
                    {cart.length}
                  </Badge>
                )}
              </Button>
            )}
          </div>

          <div className="flex items-center gap-1 sm:hidden">
            <ThemeToggle />
            {isAuthed && <NotificationBell />}
            {!isInstructor && (
              <Button
                render={<Link href="/cart" />}
                variant="ghost"
                size="icon"
                className="relative"
                aria-label="Cart"
              >
                <ShoppingCart className="h-5 w-5" />
                {mounted && cart.length > 0 && (
                  <Badge className="absolute -right-1 -top-1 h-5 min-w-5 justify-center rounded-full px-1 text-[10px]">
                    {cart.length}
                  </Badge>
                )}
              </Button>
            )}
          </div>

          {isLoading ? null : isAuthed ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                  />
                }
              >
                <Avatar className="h-8 w-8 ring-1 ring-border">
                  {user?.avatar && <AvatarImage src={user.avatar} alt="" />}
                  <AvatarFallback className="brand-gradient text-xs text-white">
                    {role === "ADMIN"
                      ? "AD"
                      : role === "INSTRUCTOR"
                        ? "IN"
                        : role === "DELIVERY_PARTNER"
                          ? "SA"
                          : role === "ORG_ADMIN"
                            ? "OA"
                            : initials(user?.name ?? "User")}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    <div className="font-medium">
                      {role === "ADMIN"
                        ? "Admin"
                        : role === "INSTRUCTOR"
                          ? "Instructor"
                          : role === "DELIVERY_PARTNER"
                            ? "Delivery Partner"
                            : role === "ORG_ADMIN"
                              ? "Company Admin"
                              : (user?.name ?? "Learner")}
                    </div>
                    <div className="text-xs font-normal text-muted-foreground">
                      {user?.email ?? ""}                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                {role === "ADMIN" ? (
                  <DropdownMenuItem render={<Link href="/admin" />}>
                    <Shield /> Admin panel
                  </DropdownMenuItem>
                ) : role === "INSTRUCTOR" ? (
                  <>
                    <DropdownMenuItem render={<Link href="/instructor" />}>
                      <LayoutDashboard /> Instructor dashboard
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      render={<Link href="/instructor/courses" />}
                    >
                      <PenSquare /> My courses
                    </DropdownMenuItem>
                  </>
                ) : role === "DELIVERY_PARTNER" ? (
                  <>
                    <DropdownMenuItem render={<Link href="/delivery-partner" />}>
                      <LayoutDashboard /> Delivery partner dashboard
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      render={<Link href="/delivery-partner/campaigns" />}
                    >
                      <Megaphone /> Campaigns
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      render={<Link href="/delivery-partner/referrals" />}
                    >
                      <Users /> My members
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      render={<Link href="/delivery-partner/earnings" />}
                    >
                      <Shield /> Earnings
                    </DropdownMenuItem>
                  </>
                ) : role === "ORG_ADMIN" ? (
                  <DropdownMenuItem render={<Link href="/org" />}>
                    <Building2 /> Organization portal
                  </DropdownMenuItem>
                ) : (
                  <>
                    <DropdownMenuItem render={<Link href="/dashboard" />}>
                      <LayoutDashboard /> Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      render={<Link href="/dashboard/progress" />}
                    >
                      <GraduationCap /> My Learning
                    </DropdownMenuItem>
                    <DropdownMenuItem render={<Link href="/account" />}>
                      <User /> Account
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>
                  <LogOut /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button render={<Link href="/login" />} variant="ghost" size="sm">
                Log in
              </Button>
              <Button render={<Link href="/signup" />} size="sm">
                Sign up
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

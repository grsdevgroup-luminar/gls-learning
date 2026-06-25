"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { RegionSelect } from "@/components/shared/region-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { demoStudent } from "@/lib/mock/students";
import { initials } from "@/lib/format";
import { ShoppingCart, Search, LayoutDashboard, GraduationCap, User, LogOut, Shield, PenSquare } from "lucide-react";

export function SiteHeader() {
  const { cart, role, logout, mounted } = useStore();
  const router = useRouter();
  const [q, setQ] = useState("");
  const isAuthed = role !== "guest";

  function search(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/courses?q=${encodeURIComponent(q)}`);
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/55">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex">
          <Button render={<Link href="/courses" />} variant="ghost" size="sm">
            Courses
          </Button>
          <Button render={<Link href={role === "instructor" ? "/instructor" : "/teach"} />} variant="ghost" size="sm">
            {role === "instructor" ? "Instructor" : "Teach"}
          </Button>
        </nav>

        <form onSubmit={search} className="relative ml-2 hidden flex-1 lg:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search for courses, topics, skills…"
            className="pl-9"
          />
        </form>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden items-center gap-0.5 rounded-full border border-border bg-muted/40 p-1 sm:flex">
            <RegionSelect
              compact
              className="h-7 gap-1 rounded-full border-0 bg-transparent px-2 shadow-none hover:bg-accent"
            />
            <span aria-hidden className="h-4 w-px bg-border" />
            <ThemeToggle size="icon-sm" className="rounded-full" />
            <span aria-hidden className="h-4 w-px bg-border" />
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
          </div>

          <div className="flex items-center gap-1 sm:hidden">
            <ThemeToggle />
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
          </div>

          {!mounted ? null : isAuthed ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon" className="rounded-full" />}
              >
                <Avatar className="h-8 w-8 ring-1 ring-border">
                  <AvatarFallback className="brand-gradient text-xs text-white">
                    {role === "admin" ? "AD" : role === "instructor" ? "IN" : initials(demoStudent.name)}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    <div className="font-medium">{role === "admin" ? "Admin" : role === "instructor" ? "Instructor" : demoStudent.name}</div>
                    <div className="text-xs font-normal text-muted-foreground">
                      {role === "admin" ? "admin@demo.com" : role === "instructor" ? "instructor@demo.com" : demoStudent.email}
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                {role === "admin" ? (
                  <DropdownMenuItem render={<Link href="/admin" />}>
                    <Shield /> Admin panel
                  </DropdownMenuItem>
                ) : role === "instructor" ? (
                  <>
                    <DropdownMenuItem render={<Link href="/instructor" />}>
                      <LayoutDashboard /> Instructor dashboard
                    </DropdownMenuItem>
                    <DropdownMenuItem render={<Link href="/instructor/courses" />}>
                      <PenSquare /> My courses
                    </DropdownMenuItem>
                    <DropdownMenuItem render={<Link href="/dashboard" />}>
                      <GraduationCap /> My Learning
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem render={<Link href="/dashboard" />}>
                      <LayoutDashboard /> Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuItem render={<Link href="/dashboard" />}>
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

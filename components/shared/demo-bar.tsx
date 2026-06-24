"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore, type Role } from "@/lib/context/store";
import { Button } from "@/components/ui/button";
import { Sparkles, X, RotateCcw, User, Shield, Eye, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const roleMeta: Record<Role, { label: string; icon: typeof User }> = {
  guest: { label: "Visitor", icon: Eye },
  student: { label: "Student", icon: User },
  instructor: { label: "Instructor", icon: GraduationCap },
  admin: { label: "Admin", icon: Shield },
};

export function DemoBar() {
  const { role, loginAs, loginAsInstructor, reset, mounted } = useStore();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (!mounted) return null;

  function go(r: Role, path: string) {
    loginAs(r);
    router.push(path);
    setOpen(false);
  }
  function goInstructor() {
    loginAsInstructor();
    router.push("/instructor");
    setOpen(false);
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 print:hidden">
      {open ? (
        <div className="w-64 rounded-xl border bg-card p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-primary" /> Demo controls
            </span>
            <button onClick={() => setOpen(false)} aria-label="Close">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <p className="mb-2 text-xs text-muted-foreground">
            Jump into any view instantly. Current:{" "}
            <span className="font-medium text-foreground">{roleMeta[role].label}</span>
          </p>
          <div className="grid gap-1.5">
            <Button variant="outline" size="sm" className="justify-start" onClick={() => go("guest", "/")}>
              <Eye /> View as visitor
            </Button>
            <Button variant="outline" size="sm" className="justify-start" onClick={() => go("student", "/dashboard")}>
              <User /> View as student
            </Button>
            <Button variant="outline" size="sm" className="justify-start" onClick={goInstructor}>
              <GraduationCap /> View as instructor
            </Button>
            <Button variant="outline" size="sm" className="justify-start" onClick={() => go("admin", "/admin")}>
              <Shield /> View as admin
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="justify-start text-muted-foreground"
              onClick={() => {
                reset();
                toast.success("Demo data reset");
              }}
            >
              <RotateCcw /> Reset demo data
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="sm"
          onClick={() => setOpen(true)}
          className={cn("rounded-full shadow-lg")}
        >
          <Sparkles /> Demo · {roleMeta[role].label}
        </Button>
      )}
    </div>
  );
}

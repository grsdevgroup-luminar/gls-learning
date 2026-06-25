"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore, type Role } from "@/lib/context/store";
import { Button } from "@/components/ui/button";
import { Sparkles, X, RotateCcw, User, Shield, Eye, GraduationCap, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const roleMeta: Record<Role, { label: string; icon: typeof User }> = {
  guest: { label: "Visitor", icon: Eye },
  student: { label: "Student", icon: User },
  instructor: { label: "Instructor", icon: GraduationCap },
  admin: { label: "Admin", icon: Shield },
};

const DRAG_THRESHOLD = 4;
const EDGE_MARGIN = 8;

export function DemoBar() {
  const { role, loginAs, loginAsInstructor, reset, mounted } = useStore();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ dragging: false, moved: false, offsetX: 0, offsetY: 0, startX: 0, startY: 0 });

  function clamp(x: number, y: number) {
    const el = containerRef.current;
    const width = el?.offsetWidth ?? 0;
    const height = el?.offsetHeight ?? 0;
    const maxX = Math.max(window.innerWidth - width - EDGE_MARGIN, EDGE_MARGIN);
    const maxY = Math.max(window.innerHeight - height - EDGE_MARGIN, EDGE_MARGIN);
    return {
      x: Math.min(Math.max(x, EDGE_MARGIN), maxX),
      y: Math.min(Math.max(y, EDGE_MARGIN), maxY),
    };
  }

  useEffect(() => {
    setPos((p) => (p ? clamp(p.x, p.y) : p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!mounted) return null;

  function handlePointerDown(e: React.PointerEvent) {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    drag.current = {
      dragging: true,
      moved: false,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      startX: e.clientX,
      startY: e.clientY,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!drag.current.dragging) return;
    if (
      !drag.current.moved &&
      (Math.abs(e.clientX - drag.current.startX) > DRAG_THRESHOLD ||
        Math.abs(e.clientY - drag.current.startY) > DRAG_THRESHOLD)
    ) {
      drag.current.moved = true;
    }
    if (drag.current.moved) {
      setPos(clamp(e.clientX - drag.current.offsetX, e.clientY - drag.current.offsetY));
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    drag.current.dragging = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  }

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
    <div
      ref={containerRef}
      className="fixed z-50 print:hidden"
      style={pos ? { left: pos.x, top: pos.y } : { left: 16, bottom: 16 }}
    >
      {open ? (
        <div className="w-64 rounded-xl border bg-card p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <span
              className="flex touch-none items-center gap-1.5 text-sm font-semibold cursor-grab active:cursor-grabbing"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
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
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onClick={() => {
            if (!drag.current.moved) setOpen(true);
          }}
          className={cn("touch-none rounded-full shadow-lg cursor-grab active:cursor-grabbing")}
        >
          <Sparkles /> Demo · {roleMeta[role].label}
        </Button>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useStore } from "@/lib/context/store";
import type { NavItem } from "@/components/shared/portal-shell";
import { Search, CornerDownLeft, ArrowRight, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

type Cmd = {
  id: string;
  label: string;
  hint?: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
};

export function CommandPalette({ items }: { items: NavItem[] }) {
  const { courses } = useStore();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const commands: Cmd[] = useMemo(() => {
    const nav: Cmd[] = items.map((it) => ({
      id: it.href,
      label: it.label,
      href: it.href,
      icon: it.icon,
      group: "Navigation",
    }));
    const courseCmds: Cmd[] = courses
      .filter((c) => c.status === "published")
      .slice(0, 8)
      .map((c) => ({
        id: c.id,
        label: c.title,
        hint: "Open course",
        href: `/learn/${c.slug}`,
        icon: GraduationCap,
        group: "Courses",
      }));
    return [...nav, ...courseCmds];
  }, [items, courses]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(needle));
  }, [q, commands]);

  // Reset the highlight whenever the query changes — adjusting state during
  // render instead of syncing in an effect.
  const [prevQ, setPrevQ] = useState(q);
  if (prevQ !== q) {
    setPrevQ(q);
    setActive(0);
  }

  useEffect(() => {
    if (open) {
      const id = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(id);
    }
  }, [open]);

  function run(cmd: Cmd) {
    setOpen(false);
    setQ("");
    router.push(cmd.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      run(results[active]);
    }
  }

  let lastGroup = "";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm text-muted-foreground shadow-xs transition-colors hover:text-foreground"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px] font-medium">
          ⌘K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="top-[18%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg"
        >
          <DialogTitle className="sr-only">Command menu</DialogTitle>
          <div className="flex items-center gap-2.5 border-b border-border px-4">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search pages and courses…"
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {results.length === 0 && (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                No results for “{q}”
              </p>
            )}
            {results.map((cmd, i) => {
              const showGroup = cmd.group !== lastGroup;
              lastGroup = cmd.group;
              return (
                <div key={cmd.id}>
                  {showGroup && (
                    <div className="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {cmd.group}
                    </div>
                  )}
                  <button
                    onMouseEnter={() => setActive(i)}
                    onClick={() => run(cmd)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                      i === active
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    <cmd.icon className="size-4 shrink-0" />
                    <span className="flex-1 truncate text-foreground">{cmd.label}</span>
                    {cmd.hint && (
                      <span className="text-xs text-muted-foreground">{cmd.hint}</span>
                    )}
                    {i === active ? (
                      <CornerDownLeft className="size-3.5 text-muted-foreground" />
                    ) : (
                      <ArrowRight className="size-3.5 opacity-0" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

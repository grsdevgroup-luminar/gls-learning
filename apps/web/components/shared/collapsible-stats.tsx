"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Wraps a stat-card grid so it collapses to a one-line summary on mobile
 * (where it would otherwise push the table/list below the fold) while
 * always staying fully expanded from `sm` up, where there's room for it.
 */
export function CollapsibleStats({
  summary,
  children,
  className,
}: {
  /** Compact one-line summary shown on the collapsed mobile toggle. */
  summary: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("shrink-0", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left shadow-sm sm:hidden"
      >
        <span className="min-w-0 truncate text-sm text-muted-foreground">
          {summary}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      <div className={cn(!open && "hidden", "sm:!block")}>{children}</div>
    </div>
  );
}

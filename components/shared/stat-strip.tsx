import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The hairline-divided KPI strip used on the student and admin dashboards:
 * a single bordered panel whose cells are separated by 1px gaps rather than
 * floating cards. Previously hand-rolled in each dashboard.
 */
function StatStrip({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "grid gap-px overflow-hidden rounded-xl border border-border bg-border shadow-sm",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  delta,
  tint,
  className,
}: {
  icon?: LucideIcon;
  label: React.ReactNode;
  value: React.ReactNode;
  /** Optional trailing element: a delta chip, sparkline, etc. */
  delta?: React.ReactNode;
  /** Drives the icon-tile hue (a CSS color / var). Defaults to primary. */
  tint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("group flex flex-col bg-card p-5", className)}
      style={tint ? ({ ["--tile" as string]: tint } as React.CSSProperties) : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        {Icon && (
          <span className="icon-tile size-8">
            <Icon className="size-4" />
          </span>
        )}
        {delta}
      </div>
      <div className="mt-3 text-2xl font-bold leading-none tracking-tight tabular-nums">
        {value}
      </div>
      <div className="mt-1.5 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export { StatStrip, Stat };

"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function AdminTableCard({
  children,
  className,
  scrollClassName,
}: {
  children: React.ReactNode;
  className?: string;
  scrollClassName?: string;
}) {
  return (
    <Card className={cn("min-h-0 p-0", className)}>
      <CardContent className="min-h-0 px-0">
        <div
          className={cn(
            "max-h-[560px] overflow-y-auto [&_[data-slot=table-container]]:overflow-visible",
            scrollClassName,
          )}
        >
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

export const stickyHeaderRowClass =
  "bg-card hover:bg-card";

export const stickyHeaderCellClass =
  "sticky top-0 z-20 bg-card shadow-[inset_0_-1px_0_0_hsl(var(--border))]";

"use client";

import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { StaggerItem } from "@/components/shared/motion";
import { cn } from "@/lib/utils";

/**
 * Label + control wrapper for form pages. Cascades in as a <StaggerItem>
 * (wrap a field group in <Stagger> to trigger it) and blooms an aurora glow
 * on focus via the `field-glow` utility in globals.css.
 */
export function FormField({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <StaggerItem y={10} className={cn("field-glow space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={htmlFor}>{label}</Label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </StaggerItem>
  );
}

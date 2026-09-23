"use client";

import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

const requirements = [
  { label: "At least 8 characters", test: (value: string) => value.length >= 8 },
  { label: "One uppercase letter", test: (value: string) => /[A-Z]/.test(value) },
  { label: "One lowercase letter", test: (value: string) => /[a-z]/.test(value) },
  { label: "One number", test: (value: string) => /[0-9]/.test(value) },
  { label: "One special character", test: (value: string) => /[^A-Za-z0-9]/.test(value) },
] as const;

export function PasswordRequirements({ value }: { value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3" aria-live="polite">
      <p className="mb-2 text-xs font-medium text-foreground">Password requirements</p>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {requirements.map((requirement) => {
          const valid = requirement.test(value);
          return (
            <li key={requirement.label} className={cn("flex items-center gap-2 text-xs transition-colors", valid ? "text-success" : "text-muted-foreground")}>
              {valid ? <Check className="size-3.5" aria-hidden="true" /> : <Circle className="size-3.5" aria-hidden="true" />}
              <span>{requirement.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

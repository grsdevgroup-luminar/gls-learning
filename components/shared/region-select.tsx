"use client";

import { useStore } from "@/lib/context/store";
import { regions } from "@/lib/mock/pricing";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";

export function RegionSelect({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { regionCode, setRegionCode } = useStore();

  return (
    <Select value={regionCode} onValueChange={(v) => v && setRegionCode(v)}>
      <SelectTrigger className={cn(compact ? "h-9 w-auto gap-1.5" : "w-full", className)} size="sm">
        {compact ? (
          <Globe className="h-4 w-4 opacity-70" />
        ) : (
          <SelectValue />
        )}
        {compact && (
          <span className="text-sm">
            {regions.find((r) => r.code === regionCode)?.flag}{" "}
            {regions.find((r) => r.code === regionCode)?.currency}
          </span>
        )}
      </SelectTrigger>
      <SelectContent>
        {regions.map((r) => (
          <SelectItem key={r.code} value={r.code}>
            <span className="mr-1">{r.flag}</span> {r.country}{" "}
            <span className="text-muted-foreground">· {r.currency}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

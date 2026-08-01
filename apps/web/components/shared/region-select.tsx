"use client";

import { useStore } from "@/lib/context/store";
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
  const { regionCode, setRegionCode, region, regions } = useStore();

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
            {region.flag} {region.currency}
          </span>
        )}
      </SelectTrigger>
      <SelectContent
        alignItemWithTrigger={false}
        align="end"
        className="w-auto min-w-56"
      >
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

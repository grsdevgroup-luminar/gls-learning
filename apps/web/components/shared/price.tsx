"use client";

import { useStore } from "@/lib/context/store";
import { regionalUsd, formatLocal } from "@/lib/pricing";
import { formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

// Region-aware price. Shows the discounted USD price, plus the local-currency
// equivalent and a "regional price" hint when a PPP discount applies.
export function Price({
  basePrice,
  originalPrice,
  className,
  size = "md",
  showLocal = true,
}: {
  basePrice: number;
  originalPrice?: number;
  className?: string;
  size?: "sm" | "md" | "lg";
  showLocal?: boolean;
}) {
  const { region, mounted } = useStore();
  const usd = regionalUsd(basePrice, region);
  const discounted = region.multiplier < 1;
  const sizes = {
    sm: "text-base",
    md: "text-xl",
    lg: "text-3xl",
  } as const;

  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-0.5", className)}>
      <span className={cn("font-bold tracking-tight", sizes[size])}>{formatUsd(usd)}</span>
      {originalPrice && originalPrice > usd && (
        <span className="text-sm text-muted-foreground line-through">
          {formatUsd(originalPrice)}
        </span>
      )}
      {mounted && showLocal && region.code !== "US" && (
        <span className="text-xs text-muted-foreground">
          ≈ {formatLocal(usd, region)}
          {discounted && (
            <span className="ml-1 rounded bg-success/15 px-1.5 py-0.5 font-medium text-success">
              regional price
            </span>
          )}
        </span>
      )}
    </div>
  );
}

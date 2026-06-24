"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function StarRatingInput({
  value,
  onChange,
  size = 24,
  className,
}: {
  value: number;
  onChange: (rating: number) => void;
  size?: number;
  className?: string;
}) {
  const [hover, setHover] = useState(0);
  const display = hover || value;

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = display >= i;
        return (
          <button
            key={i}
            type="button"
            aria-label={`Rate ${i} star${i > 1 ? "s" : ""}`}
            aria-pressed={value >= i}
            onClick={() => onChange(i)}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(0)}
            className="grid place-items-center rounded-md p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ width: size + 6, height: size + 6 }}
          >
            <Star
              style={{ width: size, height: size }}
              className={cn(
                "transition-colors duration-150",
                filled ? "text-amber-400" : "text-muted-foreground/25",
              )}
              fill="currentColor"
            />
          </button>
        );
      })}
    </span>
  );
}

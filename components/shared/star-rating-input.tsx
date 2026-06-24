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
    <span className={cn("inline-flex items-center gap-1", className)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          aria-label={`Rate ${i} star${i > 1 ? "s" : ""}`}
          onClick={() => onChange(i)}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          className="transition-transform hover:scale-110"
        >
          <Star
            style={{ width: size, height: size }}
            className={display >= i ? "text-amber-400" : "text-muted-foreground/30"}
            fill="currentColor"
          />
        </button>
      ))}
    </span>
  );
}

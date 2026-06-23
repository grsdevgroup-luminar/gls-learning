import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function Stars({
  rating,
  size = 14,
  className,
  showValue = false,
}: {
  rating: number;
  size?: number;
  className?: string;
  showValue?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {showValue && (
        <span className="mr-1 font-semibold text-warning-foreground/90 tabular-nums">
          {rating.toFixed(1)}
        </span>
      )}
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, rating - i));
        return (
          <span key={i} className="relative" style={{ width: size, height: size }}>
            <Star
              className="absolute inset-0 text-muted-foreground/30"
              style={{ width: size, height: size }}
              fill="currentColor"
            />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star
                className="text-amber-400"
                style={{ width: size, height: size }}
                fill="currentColor"
              />
            </span>
          </span>
        );
      })}
    </span>
  );
}

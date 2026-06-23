import { cn } from "@/lib/utils";

// Lightweight, fully style-able progress bar (avoids Base UI Progress quirks).
export function Meter({
  value,
  className,
  barClassName,
  height = 8,
}: {
  value: number;
  className?: string;
  barClassName?: string;
  height?: number;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn("w-full overflow-hidden rounded-full bg-muted", className)}
      style={{ height }}
    >
      <div
        className={cn("h-full rounded-full bg-primary transition-all", barClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

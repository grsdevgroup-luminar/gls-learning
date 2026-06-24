import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function CircularProgress({
  value,
  size = 36,
  strokeWidth = 4,
  className,
  showLabel = true,
  children,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  showLabel?: boolean;
  children?: ReactNode;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);
  const complete = pct >= 100;

  return (
    <div className={cn("relative inline-grid place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(
            "transition-[stroke-dashoffset] duration-700 ease-out",
            complete ? "stroke-success" : "stroke-primary",
          )}
        />
      </svg>
      <span className={cn("absolute grid place-items-center", complete && "animate-[complete-pop_0.4s_ease-out]")}>
        {children ?? (showLabel && <span className="text-[10px] font-semibold tabular-nums">{pct}%</span>)}
      </span>
    </div>
  );
}

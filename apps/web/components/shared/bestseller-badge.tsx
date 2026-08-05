import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

export function BestsellerBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm bg-amber-400 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-950",
        className,
      )}
    >
      <Flame className="size-3" />
      Bestseller
    </span>
  );
}

/** A course earns this when its rating sits at the top tier of the catalog. */
export function isHighestRated(course: { ratingAvg: number; reviewCount: number }) {
  return course.ratingAvg >= 4.9 && course.reviewCount >= 100;
}

export function HighestRatedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm bg-indigo-500 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white",
        className,
      )}
    >
      Highest Rated
    </span>
  );
}

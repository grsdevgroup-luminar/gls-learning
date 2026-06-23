import { gradientFor } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Atom, Braces, BrainCircuit, PenTool, Cloud, TrendingUp, Code2, Layers,
  type LucideIcon,
} from "lucide-react";

const icons: Record<string, LucideIcon> = {
  react: Atom,
  typescript: Braces,
  ml: BrainCircuit,
  design: PenTool,
  aws: Cloud,
  growth: TrendingUp,
  python: Code2,
  system: Layers,
};

export function CourseArt({
  seed,
  title,
  category,
  className,
  iconSize = 44,
}: {
  seed: string;
  title: string;
  category?: string;
  className?: string;
  iconSize?: number;
}) {
  const Icon = icons[seed] ?? Code2;
  return (
    <div
      className={cn("relative flex flex-col justify-between overflow-hidden p-4 text-white", className)}
      style={{ backgroundImage: gradientFor(seed || title) }}
    >
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/15 blur-xl" />
      <div className="absolute -bottom-8 -left-4 h-28 w-28 rounded-full bg-black/10 blur-xl" />
      {category && (
        <span className="relative z-10 w-fit rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-medium backdrop-blur">
          {category}
        </span>
      )}
      <Icon
        className="absolute right-3 bottom-3 z-0 opacity-90 drop-shadow"
        style={{ width: iconSize, height: iconSize }}
        strokeWidth={1.5}
      />
      <span className="relative z-10 mt-auto max-w-[80%] text-sm font-semibold leading-tight drop-shadow-sm line-clamp-2">
        {title}
      </span>
    </div>
  );
}

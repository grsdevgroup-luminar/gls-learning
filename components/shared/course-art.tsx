import { gradientFor } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Atom, Braces, BrainCircuit, PenTool, Cloud, TrendingUp, Code2, Layers,
  Mic, HeartHandshake, PiggyBank, Sparkles, Languages,
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
  speaking: Mic,
  social: HeartHandshake,
  finance: PiggyBank,
  mindfulness: Sparkles,
  language: Languages,
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
  // Small thumbnails (list rows, cart items) have no room for the title/category
  // overlay — at text-sm + p-4 padding the text gets clipped by overflow-hidden
  // and reads as garbled glyphs instead of words, so we drop the text and just
  // center the icon below this size.
  const compact = iconSize < 32;

  if (compact) {
    return (
      <div
        className={cn("relative flex items-center justify-center overflow-hidden text-white", className)}
        style={{ backgroundImage: gradientFor(seed || title) }}
      >
        <Icon
          style={{ width: iconSize, height: iconSize }}
          strokeWidth={1.5}
          className="opacity-90 drop-shadow"
        />
      </div>
    );
  }

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

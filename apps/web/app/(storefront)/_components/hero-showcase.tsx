import Link from "next/link";
import {
  Code2,
  BrainCircuit,
  PenTool,
  Cloud,
  TrendingUp,
  Layers,
  ArrowRight,
} from "lucide-react";
import { Reveal, Stagger, StaggerItem, Parallax } from "@/components/shared/motion";

/**
 * Neutral hero right-column. Replaces the previous single-course preview to
 * avoid promoting one course above the rest. Shows the platform's category
 * surface: five real categories (sorted by course count) plus a "browse all"
 * tile that carries the total course count. All numbers come from live data —
 * no invented metrics.
 */

const CAT_STYLE: Record<string, { icon: typeof Code2; tint: string }> = {
  Development: { icon: Code2, tint: "var(--tint-blue)" },
  "Data Science": { icon: BrainCircuit, tint: "var(--tint-violet)" },
  Design: { icon: PenTool, tint: "var(--tint-rose)" },
  Cloud: { icon: Cloud, tint: "var(--tint-sky)" },
  Marketing: { icon: TrendingUp, tint: "var(--tint-emerald)" },
};

export function HeroShowcase({
  categories,
  countByCategory,
  totalCourses,
}: {
  categories: string[];
  countByCategory: Record<string, number>;
  totalCourses: number;
}) {
  // Top 5 categories by course count — deterministic, no bias to any single course.
  const top = [...categories]
    .sort(
      (a, b) => (countByCategory[b] ?? 0) - (countByCategory[a] ?? 0),
    )
    .slice(0, 5);

  return (
    <Parallax distance={40} className="relative hidden lg:block">
      <Reveal y={32} delay={0.1}>
        {/* Aurora bloom behind the grid — matches the depth the old preview card
            provided so the right column doesn't read as flat on dark mode. */}
        <div className="pointer-events-none absolute -inset-8 -z-10 rounded-[2rem] bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--aurora-2)_35%,transparent),transparent)] opacity-0 blur-2xl dark:opacity-40" />

        <Stagger className="grid grid-cols-2 gap-3" gap={0.06}>
          {top.map((cat) => {
            const entry = CAT_STYLE[cat];
            const Icon = entry?.icon ?? Layers;
            const tint = entry?.tint ?? "var(--primary)";
            const count = countByCategory[cat] ?? 0;
            return (
              <StaggerItem key={cat} y={12}>
                <Link
                  href={`/courses?category=${encodeURIComponent(cat)}`}
                  className="group flex h-full flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  style={{ ["--tile" as string]: tint }}
                >
                  <span className="icon-tile size-11">
                    <Icon className="size-5" />
                  </span>
                  <div className="mt-auto">
                    <h3 className="font-semibold leading-snug text-foreground">
                      {cat}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                      {count} {count === 1 ? "course" : "courses"}
                    </p>
                  </div>
                </Link>
              </StaggerItem>
            );
          })}

          {/* Neutral "browse all" tile — carries the honest total-course count and
              routes to the unfiltered catalogue. */}
          <StaggerItem y={12}>
            <Link
              href="/courses"
              className="group flex h-full flex-col justify-between rounded-2xl border border-border bg-foreground p-5 text-background shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <span className="text-[0.7rem] font-medium uppercase tracking-wider text-background/60">
                Browse all
              </span>
              <div>
                <p className="text-3xl font-bold tabular-nums">
                  {totalCourses}
                </p>
                <p className="mt-1 flex items-center gap-1 text-sm text-background/70">
                  courses
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </p>
              </div>
            </Link>
          </StaggerItem>
        </Stagger>
      </Reveal>
    </Parallax>
  );
}

import Link from "next/link";
import { CourseCard } from "./_components/course-card";
import { PersonalizedRecommendations } from "./_components/personalized-recommendations";
import { HeroShowcase } from "./_components/hero-showcase";
import { Button } from "@/components/ui/button";
import { Stars } from "@/components/shared/stars";
import { Section, SectionHeading } from "@/components/shared/section";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Reveal,
  Stagger,
  StaggerItem,
  Counter,
  Parallax,
  Magnetic,
} from "@/components/shared/motion";
import { serverApi } from "@/lib/api/server";
import { MAX_PAGE_SIZE } from "@skillstream/shared";
import type {
  CourseSummaryDto,
  InstructorRosterDto,
  Paginated,
  ReviewDto,
} from "@skillstream/shared";
import { compactNumber, initials } from "@/lib/format";
import {
  ShieldCheck, Globe2, LineChart, BellRing, ArrowRight, Star,
  Sparkles, Code2, BrainCircuit, PenTool, Cloud, TrendingUp, Layers,
} from "lucide-react";

const features = [
  {
    icon: ShieldCheck,
    title: "Protected video",
    desc: "Secure streaming with per-student watermarks and no downloadable copies keeps your content safe.",
    tint: "var(--tint-indigo)",
  },
  {
    icon: Globe2,
    title: "Region-fair pricing",
    desc: "Automatic purchasing-power pricing and per-country rates make courses affordable everywhere.",
    tint: "var(--tint-teal)",
  },
  {
    icon: LineChart,
    title: "Progress tracking",
    desc: "Granular lesson tracking, streaks, and certificates keep learners motivated and on track.",
    tint: "var(--tint-violet)",
  },
  {
    icon: BellRing,
    title: "Smart reminders",
    desc: "Automated email & SMS nudges re-engage idle and at-risk students before you lose them.",
    tint: "var(--tint-amber)",
  },
];

const catIcons: Record<string, { icon: typeof Code2; tint: string }> = {
  Development: { icon: Code2, tint: "var(--tint-blue)" },
  "Data Science": { icon: BrainCircuit, tint: "var(--tint-violet)" },
  Design: { icon: PenTool, tint: "var(--tint-rose)" },
  Cloud: { icon: Cloud, tint: "var(--tint-sky)" },
  Marketing: { icon: TrendingUp, tint: "var(--tint-emerald)" },
};

/** The landing page must render even if the API blips — a half-populated
 *  marketing page beats a 500. Each section degrades to empty on its own. */
async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

export default async function HomePage() {
  // Server-fetched so the landing page ships real, indexable content.
  const [coursePage, instructors, categories, testimonials] = await Promise.all([
    safe(serverApi<Paginated<CourseSummaryDto>>(`/courses?pageSize=${MAX_PAGE_SIZE}`), {
      items: [],
      page: 1,
      pageSize: 0,
      total: 0,
      totalPages: 0,
    }),
    safe(serverApi<InstructorRosterDto[]>("/instructors"), []),
    safe(serverApi<string[]>("/categories"), []),
    safe(serverApi<ReviewDto[]>("/reviews/featured"), []),
  ]);

  const publishedCourses = coursePage.items;
  const bestsellers = publishedCourses?.filter((c) => c.bestseller)?.slice(0, 4) ?? [];
  const popular = publishedCourses?.slice(0, 8) ?? [];
  // Course counts per category — feeds the neutral hero showcase and lets it
  // rank categories by volume without promoting any single course.
  const countByCategory = publishedCourses.reduce<Record<string, number>>(
    (acc, c) => {
      if (c.category) acc[c.category] = (acc[c.category] ?? 0) + 1;
      return acc;
    },
    {},
  );

  return (
    <>
      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border">
        {/* Conic aurora bloom behind the headline */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <Parallax distance={40} className="absolute inset-0">
            <div className="absolute left-1/2 top-[-14rem] h-[40rem] w-[60rem] -translate-x-1/2 rounded-full bg-[conic-gradient(from_180deg_at_50%_50%,color-mix(in_oklch,var(--aurora-1)_30%,transparent),color-mix(in_oklch,var(--aurora-2)_30%,transparent),color-mix(in_oklch,var(--aurora-3)_30%,transparent),color-mix(in_oklch,var(--aurora-1)_30%,transparent))] opacity-[0.18] blur-[100px] dark:opacity-30" />
          </Parallax>
        </div>

        <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
          <Reveal y={24} className="">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground shadow-xs backdrop-blur">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success/60" />
                <span className="relative inline-flex size-1.5 rounded-full bg-success" />
              </span>
              500,000+ learners worldwide
            </div>

            <h1 className="text-display mt-6 text-balance text-5xl md:text-6xl lg:text-7xl">
              Learn anything,
              <br />
              <span className="text-brand-gradient">grow everywhere.</span>
            </h1>

            <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
              World-class courses with protected video, progress that keeps you
              going, and fair pricing for your region. Start today.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Magnetic>
                <Button render={<Link href="/courses" />} size="lg" className="sheen">
                  Browse courses <ArrowRight />
                </Button>
              </Magnetic>
              <Button
                render={<Link href="#categories" />}
                size="lg"
                variant="outline"
              >
                <Sparkles /> Explore categories
              </Button>
            </div>

            <dl className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-4">
              <Stat
                value={
                  <span className="inline-flex items-center gap-1">
                    <Counter value={4.8} decimals={1} />
                    <Star className="size-4 fill-warning text-warning" />
                  </span>
                }
                label="28k+ ratings"
              />
              <Divider />
              <Stat
                value={<Counter value={publishedCourses.length * 40} suffix="+" />}
                label="courses"
              />
              <Divider />
              <Stat value={<Counter value={120} suffix="+" />} label="countries" />
            </dl>
          </Reveal>

          {/* Neutral platform showcase — replaces the single-course preview so no
              one course is elevated above the rest. Every number is real. */}
          <HeroShowcase
            categories={categories}
            countByCategory={countByCategory}
            totalCourses={coursePage.total || publishedCourses.length}
          />
        </div>
      </section>

      {/* ── Category rail ──────────────────────────────────────── */}
      <section id="categories" className="mx-auto max-w-7xl px-4 py-10">
        <Stagger className="flex flex-wrap gap-2.5" gap={0.04} amount={0.3}>
          {categories.map((cat) => {
            const entry = catIcons[cat];
            const Icon = entry?.icon ?? Layers;
            const tint = entry?.tint ?? "var(--primary)";
            return (
              <StaggerItem key={cat} y={10}>
                <Link
                  href={`/courses?category=${encodeURIComponent(cat)}`}
                  className="group/cat inline-flex items-center gap-2 rounded-lg border border-border bg-card/80 py-1.5 pl-1.5 pr-3.5 text-sm font-medium text-muted-foreground shadow-xs backdrop-blur transition-all hover:-translate-y-0.5 hover:text-foreground hover:shadow-sm"
                  style={{ ["--tile" as string]: tint }}
                >
                  <span className="icon-tile size-7">
                    <Icon className="size-3.5" />
                  </span>
                  {cat}
                </Link>
              </StaggerItem>
            );
          })}
        </Stagger>
      </section>

      {/* ── Bestsellers ────────────────────────────────────────── */}
      <SectionGrid
        title="Bestselling courses"
        sub="Loved by hundreds of thousands of learners"
        courses={bestsellers}
      />

      <PersonalizedRecommendations />

      {/* ── Features (integrated panel, not floating cards) ─────── */}
      <Section tinted size="lg">
          <SectionHeading
            eyebrow="Built for serious creators"
            title="Everything a modern course business needs"
          />
          <Stagger className="mt-12 grid divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm md:grid-cols-2 md:divide-y-0 lg:grid-cols-4 lg:[&>*:not(:first-child)]:border-l">
            {features.map((f) => (
              <StaggerItem
                key={f.title}
                className="group p-6 transition-colors hover:bg-secondary/40 md:[&:nth-child(n+3)]:border-t lg:[&:nth-child(n+3)]:border-t-0"
                style={{ ["--tile" as string]: f.tint }}
              >
                <div className="icon-tile size-10">
                  <f.icon className="size-[18px]" />
                </div>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </StaggerItem>
            ))}
          </Stagger>
      </Section>

      {/* ── Popular ────────────────────────────────────────────── */}
      <SectionGrid title="Popular right now" courses={popular} />

      {/* ── Instructors ────────────────────────────────────────── */}
      <Section tinted size="lg">
          <SectionHeading
            eyebrow="Taught by practitioners"
            title="Learn from the best"
            className="mb-10"
          />
          <Stagger className="grid gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-5" gap={0.06}>
          {instructors?.slice(0, 5)?.map((i) => (
              <StaggerItem key={i.id} className="group text-center" y={16}>
                <Link href={`/instructors/${i.id}`}>
                  <Avatar className="mx-auto size-16 ring-1 ring-border transition-all duration-300 group-hover:-translate-y-1 group-hover:ring-2 group-hover:ring-primary/40">
                    <AvatarFallback className="brand-gradient text-lg text-white">
                      {initials(i.name)}
                    </AvatarFallback>
                  </Avatar>
                  <h3 className="mt-3 font-semibold group-hover:underline">{i.name}</h3>
                </Link>
                <p className="text-xs text-muted-foreground">{i.title}</p>
                <div className="mt-2 flex items-center justify-center">
                  <Stars rating={i.ratingAvg} size={12} showValue />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {compactNumber(i.studentCount)} students
                </p>
              </StaggerItem>
            ))}
          </Stagger>
      </Section>

      {/* ── Testimonials ───────────────────────────────────────── */}
      {testimonials.length > 0 && (
        <Section size="lg">
          <SectionHeading
            eyebrow="Loved worldwide"
            title="What learners say"
            className="mb-10"
          />
          <Stagger className="grid gap-5 md:grid-cols-3" gap={0.1}>
            {testimonials.map((t) => (
              <StaggerItem key={t.id}>
                <figure className="flex h-full flex-col rounded-xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg">
                  <Stars rating={t.rating} size={15} />
                  <blockquote className="mt-4 flex-1 text-[0.9375rem] leading-relaxed text-foreground/90">
                    “{t.body}”
                  </blockquote>
                  <figcaption className="mt-5 flex items-center gap-3 border-t border-border pt-4">
                    <Avatar className="size-9">
                      {t.avatar && <AvatarImage src={t.avatar} alt={t.author} />}
                      <AvatarFallback className="text-xs">{initials(t.author)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-sm font-medium">{t.author}</div>
                      <div className="text-xs text-muted-foreground">{t.courseTitle}</div>
                    </div>
                  </figcaption>
                </figure>
              </StaggerItem>
            ))}
          </Stagger>
        </Section>
      )}

      {/* ── CTA ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-24">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-border bg-foreground px-8 py-16 text-center text-background shadow-xl">
            <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:radial-gradient(circle_at_1px_1px,currentColor_1px,transparent_0)] [background-size:22px_22px]" />
            <div className="pointer-events-none absolute -inset-x-20 -top-32 h-64 bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--aurora-2)_60%,transparent),transparent)] opacity-40 blur-2xl" />
            <h2 className="relative text-3xl font-bold tracking-tight md:text-4xl">
              Start learning today
            </h2>
            <p className="relative mx-auto mt-3 max-w-md text-background/70">
              Join half a million learners. Get the launch discount before it ends.
            </p>
            <Magnetic className="relative mt-7">
              <Button
                render={<Link href="/courses" />}
                size="lg"
                variant="secondary"
                className="sheen"
              >
                Explore all courses <ArrowRight />
              </Button>
            </Magnetic>
          </div>
        </Reveal>
      </section>
    </>
  );
}

function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div>
      <dt className="text-lg font-semibold tracking-tight tabular-nums">{value}</dt>
      <dd className="text-sm text-muted-foreground">{label}</dd>
    </div>
  );
}

function Divider() {
  return <span className="hidden h-8 w-px bg-border sm:block" />;
}

function SectionGrid({
  title,
  sub,
  courses,
}: {
  title: string;
  sub?: string;
  courses: CourseSummaryDto[];
}) {
  return (
    <Section>
      <SectionHeading
        title={title}
        sub={sub}
        className="mb-8"
        action={
          <Button render={<Link href="/courses" />} variant="ghost" className="shrink-0">
            View all <ArrowRight />
          </Button>
        }
      />
      <Stagger className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4" gap={0.07}>
        {courses?.map((c) => (
          <StaggerItem key={c.id} className="h-full">
            <CourseCard course={c} />
          </StaggerItem>
        ))}
      </Stagger>
    </Section>
  );
}


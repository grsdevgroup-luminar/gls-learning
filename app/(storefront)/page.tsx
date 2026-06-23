import Link from "next/link";
import { SaleBanner } from "@/components/storefront/sale-banner";
import { CourseCard } from "@/components/storefront/course-card";
import { Button } from "@/components/ui/button";
import { Stars } from "@/components/shared/stars";
import { CourseArt } from "@/components/shared/course-art";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { publishedCourses, categories } from "@/lib/mock/courses";
import { instructors } from "@/lib/mock/instructors";
import { compactNumber, initials } from "@/lib/format";
import {
  ShieldCheck, Globe2, LineChart, BellRing, ArrowRight, Star,
  PlayCircle, Code2, BrainCircuit, PenTool, Cloud, TrendingUp, Layers,
} from "lucide-react";

const features = [
  {
    icon: ShieldCheck,
    title: "Protected video",
    desc: "DRM-grade streaming with per-student watermarks and download protection keeps your content safe.",
  },
  {
    icon: Globe2,
    title: "Region-fair pricing",
    desc: "Automatic purchasing-power pricing and per-country rates make courses affordable everywhere.",
  },
  {
    icon: LineChart,
    title: "Progress tracking",
    desc: "Granular lesson tracking, streaks, and certificates keep learners motivated and on track.",
  },
  {
    icon: BellRing,
    title: "Smart reminders",
    desc: "Automated email & SMS nudges re-engage idle and at-risk students before you lose them.",
  },
];

const catIcons: Record<string, typeof Code2> = {
  Development: Code2,
  "Data Science": BrainCircuit,
  Design: PenTool,
  Cloud: Cloud,
  Marketing: TrendingUp,
};

const testimonials = [
  { name: "Jordan M.", role: "Frontend Developer", text: "The protected player and progress tracking feel premium. I actually finished a course for once thanks to the streak nudges." },
  { name: "Priya S.", role: "Founder", text: "Region pricing meant my team in three countries all paid a fair price. Checkout was effortless." },
  { name: "Chen W.", role: "Data Analyst", text: "Best learning experience I've used. The dashboards make it obvious what to do next." },
];

export default function HomePage() {
  const bestsellers = publishedCourses.filter((c) => c.bestseller);
  const popular = publishedCourses.slice(0, 8);

  return (
    <>
      <SaleBanner />

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-[-10rem] h-[36rem] w-[56rem] -translate-x-1/2 rounded-full bg-primary/[0.05] blur-3xl" />
        </div>

        <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
          <div className="animate-in fade-in slide-in-from-bottom-3 duration-700">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-xs">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success/60" />
                <span className="relative inline-flex size-1.5 rounded-full bg-success" />
              </span>
              500,000+ learners worldwide
            </div>

            <h1 className="mt-6 text-balance text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl lg:text-7xl">
              Learn anything,
              <br />
              <span className="text-primary">grow everywhere.</span>
            </h1>

            <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
              World-class courses with protected video, progress that keeps you
              going, and fair pricing for your region. Start today.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Button render={<Link href="/courses" />} size="lg">
                Browse courses <ArrowRight />
              </Button>
              <Button
                render={<Link href="/courses/modern-react-masterclass" />}
                size="lg"
                variant="outline"
              >
                <PlayCircle /> Watch a preview
              </Button>
            </div>

            <dl className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-4">
              <Stat
                value={
                  <span className="inline-flex items-center gap-1">
                    4.8 <Star className="size-4 fill-warning text-warning" />
                  </span>
                }
                label="28k+ ratings"
              />
              <Divider />
              <Stat value={`${publishedCourses.length * 40}+`} label="courses" />
              <Divider />
              <Stat value="120+" label="countries" />
            </dl>
          </div>

          {/* Product shot — an elevated, calm preview panel */}
          <HeroPreview />
        </div>
      </section>

      {/* ── Category rail ──────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="flex flex-wrap gap-2.5">
          {categories.map((cat) => {
            const Icon = catIcons[cat] ?? Layers;
            return (
              <Link
                key={cat}
                href={`/courses?category=${encodeURIComponent(cat)}`}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-muted-foreground shadow-xs transition-all hover:-translate-y-0.5 hover:text-foreground hover:shadow-sm"
              >
                <Icon className="size-4" /> {cat}
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Bestsellers ────────────────────────────────────────── */}
      <SectionGrid
        title="Bestselling courses"
        sub="Loved by hundreds of thousands of learners"
        courses={bestsellers}
      />

      {/* ── Features (integrated panel, not floating cards) ─────── */}
      <section className="border-y border-border bg-secondary/40">
        <div className="mx-auto max-w-7xl px-4 py-20">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-primary">Built for serious creators</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
              Everything a modern course business needs
            </h2>
          </div>
          <div className="mt-12 grid divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm md:grid-cols-2 md:divide-y-0 lg:grid-cols-4 lg:[&>*:not(:first-child)]:border-l">
            {features.map((f) => (
              <div key={f.title} className="group p-6 transition-colors hover:bg-secondary/40 md:[&:nth-child(n+3)]:border-t lg:[&:nth-child(n+3)]:border-t-0">
                <div className="grid size-9 place-items-center rounded-lg border border-border bg-secondary/60 text-primary transition-colors group-hover:border-primary/30">
                  <f.icon className="size-[18px]" />
                </div>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Popular ────────────────────────────────────────────── */}
      <SectionGrid title="Popular right now" courses={popular} />

      {/* ── Instructors ────────────────────────────────────────── */}
      <section className="border-t border-border bg-secondary/40">
        <div className="mx-auto max-w-7xl px-4 py-20">
          <h2 className="mb-10 text-3xl font-bold tracking-tight">Learn from the best</h2>
          <div className="grid gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
            {instructors.map((i) => (
              <div key={i.id} className="text-center">
                <Avatar className="mx-auto size-16 ring-1 ring-border">
                  <AvatarFallback className="brand-gradient text-lg text-white">
                    {initials(i.name)}
                  </AvatarFallback>
                </Avatar>
                <h3 className="mt-3 font-semibold">{i.name}</h3>
                <p className="text-xs text-muted-foreground">{i.title}</p>
                <div className="mt-2 flex items-center justify-center">
                  <Stars rating={i.rating} size={12} showValue />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {compactNumber(i.students)} students
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ───────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-20">
        <h2 className="mb-10 text-3xl font-bold tracking-tight">What learners say</h2>
        <div className="grid gap-5 md:grid-cols-3">
          {testimonials.map((t) => (
            <figure
              key={t.name}
              className="flex flex-col rounded-xl border border-border bg-card p-6 shadow-sm"
            >
              <Stars rating={5} size={15} />
              <blockquote className="mt-4 flex-1 text-[15px] leading-relaxed text-foreground/90">
                “{t.text}”
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3 border-t border-border pt-4">
                <Avatar className="size-9">
                  <AvatarFallback className="text-xs">{initials(t.name)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-sm font-medium">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.role}</div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-24">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-foreground px-8 py-16 text-center text-background shadow-md">
          <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:radial-gradient(circle_at_1px_1px,currentColor_1px,transparent_0)] [background-size:22px_22px]" />
          <h2 className="relative text-3xl font-bold tracking-tight md:text-4xl">
            Start learning today
          </h2>
          <p className="relative mx-auto mt-3 max-w-md text-background/70">
            Join half a million learners. Get the launch discount before it ends.
          </p>
          <Button
            render={<Link href="/courses" />}
            size="lg"
            variant="secondary"
            className="relative mt-7"
          >
            Explore all courses <ArrowRight />
          </Button>
        </div>
      </section>
    </>
  );
}

function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div>
      <dt className="text-lg font-semibold tracking-tight">{value}</dt>
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
  courses: typeof publishedCourses;
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
          {sub && <p className="mt-1 text-muted-foreground">{sub}</p>}
        </div>
        <Button render={<Link href="/courses" />} variant="ghost" className="shrink-0">
          View all <ArrowRight />
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {courses.map((c) => (
          <CourseCard key={c.id} course={c} />
        ))}
      </div>
    </section>
  );
}

function HeroPreview() {
  const c = publishedCourses[0];
  return (
    <div className="relative hidden animate-in fade-in slide-in-from-bottom-4 duration-1000 lg:block">
      <div className="rounded-2xl border border-border bg-card p-2 shadow-xl">
        <div className="relative overflow-hidden rounded-xl">
          <CourseArt
            seed={c.thumbnail}
            title={c.title}
            category={c.category}
            className="aspect-[16/10]"
          />
          <div className="absolute inset-0 grid place-items-center bg-black/15">
            <span className="grid size-14 place-items-center rounded-full bg-background/90 text-primary shadow-lg backdrop-blur">
              <PlayCircle className="size-7" />
            </span>
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">{c.category}</p>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
              <ShieldCheck className="size-3.5" /> DRM protected
            </span>
          </div>
          <h3 className="mt-1.5 font-semibold leading-snug">{c.title}</h3>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div className="h-full w-2/3 rounded-full bg-primary" />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Lesson 12 of 18 · 68% complete</p>
        </div>
      </div>

      {/* Floating metadata chip */}
      <div className="absolute -bottom-5 -left-5 hidden items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-lg xl:flex">
        <span className="inline-flex items-center gap-1 text-sm font-semibold">
          4.8 <Star className="size-4 fill-warning text-warning" />
        </span>
        <span className="text-xs text-muted-foreground">avg. rating</span>
      </div>
    </div>
  );
}

import type { InstructorPublicProfileDto } from "@skillstream/shared";
import { Stars } from "@/components/shared/stars";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { compactNumber, initials } from "@/lib/format";
import { BookOpen, GraduationCap, Users } from "lucide-react";

const SOCIAL_LINKS: Array<{
  key: keyof Pick<
    InstructorPublicProfileDto,
    "linkedinUrl" | "twitterUrl" | "youtubeUrl" | "facebookUrl" | "sampleUrl" | "otherUrl"
  >;
  label: string;
  glyph: React.ReactNode;
}> = [
  { key: "linkedinUrl", label: "LinkedIn", glyph: "in" },
  { key: "twitterUrl", label: "X", glyph: "X" },
  { key: "youtubeUrl", label: "YouTube", glyph: "▶" },
  { key: "facebookUrl", label: "Facebook", glyph: "f" },
  { key: "sampleUrl", label: "Portfolio", glyph: "💼" },
  { key: "otherUrl", label: "Website", glyph: "🔗" },
];

/** Server-rendered shell, mirrors course-hero.tsx's static banner pattern. */
export function InstructorHero({ instructor }: { instructor: InstructorPublicProfileDto }) {
  const links = SOCIAL_LINKS.filter((s) => instructor[s.key]);

  return (
    <section className="border-b bg-foreground text-background dark:bg-card dark:text-foreground">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 lg:grid-cols-[1fr_320px] lg:items-start lg:py-16">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Instructor</p>
          <h1 className="mt-2 break-words text-3xl font-bold tracking-tight md:text-4xl">
            {instructor.name}
          </h1>
          {instructor.title && <p className="mt-2 max-w-2xl text-lg opacity-90">{instructor.title}</p>}

          <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
            <div>
              <div className="text-2xl font-bold tabular-nums">{compactNumber(instructor.studentCount)}</div>
              <div className="text-xs opacity-70">Students</div>
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{instructor.courseCount}</div>
              <div className="text-xs opacity-70">Courses</div>
            </div>
            {instructor.ratingAvg > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-2xl font-bold tabular-nums">
                  {instructor.ratingAvg.toFixed(1)}
                  <Stars rating={instructor.ratingAvg} size={16} />
                </div>
                <div className="text-xs opacity-70">Rating</div>
              </div>
            )}
          </div>

          {instructor.bio && (
            <div className="mt-8 max-w-2xl">
              <h2 className="font-semibold">About me</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed opacity-90">{instructor.bio}</p>
            </div>
          )}

          <p className="mt-6 flex items-center gap-1.5 text-xs opacity-60">
            <GraduationCap className="size-3.5" /> Instructor since {new Date(instructor.joinedAt).getFullYear()}
          </p>
        </div>

        <div className="rounded-2xl border border-white/15 bg-background/10 p-5 backdrop-blur-sm dark:border-border dark:bg-card">
          <Avatar className="mx-auto size-28 ring-2 ring-white/20 dark:ring-border">
            {instructor.avatar && <AvatarImage src={instructor.avatar} alt="" />}
            <AvatarFallback className="brand-gradient text-2xl text-white">
              {initials(instructor.name)}
            </AvatarFallback>
          </Avatar>

          {links.length > 0 && (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {links.map((s) => (
                <a
                  key={s.key}
                  href={instructor[s.key]!}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={s.label}
                  title={s.label}
                  className="icon-tile size-9 text-sm font-semibold no-underline"
                >
                  {s.glyph}
                </a>
              ))}
            </div>
          )}

          <div className="mt-5 flex items-center justify-center gap-1.5 text-xs opacity-70">
            <Users className="size-3.5" /> {compactNumber(instructor.studentCount)} learners
            <span aria-hidden>·</span>
            <BookOpen className="size-3.5" /> {instructor.courseCount} courses
          </div>
        </div>
      </div>
    </section>
  );
}

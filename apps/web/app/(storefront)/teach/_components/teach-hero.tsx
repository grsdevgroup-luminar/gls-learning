import { Reveal } from "@/components/shared/motion";
import { GraduationCap } from "lucide-react";

export function TeachHero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-12rem] h-[34rem] w-[52rem] -translate-x-1/2 rounded-full bg-[conic-gradient(from_180deg_at_50%_50%,color-mix(in_oklch,var(--aurora-1)_30%,transparent),color-mix(in_oklch,var(--aurora-2)_30%,transparent),color-mix(in_oklch,var(--aurora-3)_30%,transparent),color-mix(in_oklch,var(--aurora-1)_30%,transparent))] opacity-[0.16] blur-[100px] dark:opacity-30" />
      </div>
      <div className="mx-auto max-w-3xl px-4 py-20 text-center lg:py-24">
        <Reveal>
          <span className="icon-tile mx-auto mb-6 grid size-14 place-items-center" style={{ ["--tile" as string]: "var(--tint-violet)" }}>
            <GraduationCap className="size-7" />
          </span>
          <h1 className="text-display text-balance text-4xl md:text-5xl lg:text-6xl">
            Share what you know.<br />
            <span className="text-brand-gradient">Teach the world.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
            Join GRS Learning&apos;s instructors and turn your expertise into a course that reaches learners everywhere.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

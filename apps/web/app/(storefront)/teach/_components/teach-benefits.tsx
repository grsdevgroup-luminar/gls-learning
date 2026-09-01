import { Section } from "@/components/shared/section";
import { DollarSign, Globe2, BarChart3, ShieldCheck } from "lucide-react";

const benefits = [
  { icon: DollarSign, title: "Earn on your terms", desc: "Keep a generous revenue share with monthly payouts and transparent analytics.", tint: "var(--tint-emerald)" },
  { icon: Globe2, title: "Reach learners worldwide", desc: "Region-fair pricing puts your course in front of students in 120+ countries.", tint: "var(--tint-sky)" },
  { icon: BarChart3, title: "Pro creator tools", desc: "A full course builder, quizzes, protected video and engagement insights.", tint: "var(--tint-indigo)" },
  { icon: ShieldCheck, title: "Quality marketplace", desc: "Every course is reviewed before launch, so your work sits alongside the best.", tint: "var(--tint-violet)" },
];

export function TeachBenefits() {
  return (
    <Section size="sm">
      <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-card shadow-sm sm:grid-cols-2 lg:grid-cols-4 lg:[&>*:not(:first-child)]:border-l">
        {benefits.map((b) => (
          <div key={b.title} className="group p-6" style={{ ["--tile" as string]: b.tint }}>
            <span className="icon-tile grid size-10 place-items-center"><b.icon className="size-[18px]" /></span>
            <h3 className="mt-4 font-semibold">{b.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{b.desc}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

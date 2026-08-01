"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStore } from "@/lib/context/store";
import { api } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useSession } from "@/lib/api/session";
import { useCategories } from "@/lib/api/hooks";
import { Section } from "@/components/shared/section";
import { Reveal, Stagger, Magnetic } from "@/components/shared/motion";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DollarSign, Globe2, BarChart3, ShieldCheck, ArrowRight, GraduationCap,
} from "lucide-react";
import { toast } from "sonner";

const benefits = [
  { icon: DollarSign, title: "Earn on your terms", desc: "Keep a generous revenue share with monthly payouts and transparent analytics.", tint: "var(--tint-emerald)" },
  { icon: Globe2, title: "Reach learners worldwide", desc: "Region-fair pricing puts your course in front of students in 120+ countries.", tint: "var(--tint-sky)" },
  { icon: BarChart3, title: "Pro creator tools", desc: "A full course builder, quizzes, protected video and engagement insights.", tint: "var(--tint-indigo)" },
  { icon: ShieldCheck, title: "Quality marketplace", desc: "Every course is reviewed before launch, so your work sits alongside the best.", tint: "var(--tint-violet)" },
];

export default function TeachPage() {
  const { role, mounted } = useStore();
  const { user } = useSession();
  const router = useRouter();
  const { data: categories = [] } = useCategories();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  // Categories load async, so hold "" and fall back to the first one on render.
  const [expertise, setExpertise] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [sampleUrl, setSampleUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const expertiseValue = expertise || categories[0] || "";

  const alreadyInstructor = mounted && role === "instructor";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      toast.error("Please log in first — your application is linked to your account.");
      router.push("/login?next=/teach");
      return;
    }
    if (!headline.trim() || !bio.trim()) {
      toast.error("Please fill in your headline and a short bio.");
      return;
    }
    setSubmitting(true);
    try {
      await api.applyInstructor({
        expertise: expertiseValue,
        headline: headline.trim(),
        bio: bio.trim(),
        sampleUrl: sampleUrl.trim() || undefined,
      });
      toast.success("Application submitted! 🎉", { description: "We'll review it within 1–2 business days." });
      router.push("/instructor");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Hero */}
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
              Join SkillStream&apos;s instructors and turn your expertise into a course that reaches learners everywhere.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Benefits */}
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

      {/* Application */}
      <Section size="sm" className="pb-24">
        <div className="mx-auto max-w-2xl">
          {alreadyInstructor ? (
            <Card variant="elevated" className="items-center py-12 text-center">
              <CardContent className="flex flex-col items-center gap-3">
                <span className="icon-tile grid size-12 place-items-center" style={{ ["--tile" as string]: "var(--tint-emerald)" }}>
                  <GraduationCap className="size-6" />
                </span>
                <p className="font-heading text-lg font-semibold">You&apos;re already an instructor</p>
                <p className="max-w-sm text-sm text-muted-foreground">Head to your instructor dashboard to manage courses and earnings.</p>
                <Button render={<Link href="/instructor" />}>Go to dashboard <ArrowRight /></Button>
              </CardContent>
            </Card>
          ) : (
            <Reveal y={20}>
              <Card variant="elevated">
                <CardHeader>
                  <CardTitle className="text-xl">Apply to teach</CardTitle>
                  <p className="text-sm text-muted-foreground">Tell us about yourself. Approved instructors can publish courses immediately.</p>
                </CardHeader>
                <CardContent>
                  <form onSubmit={submit} className="space-y-4">
                    <Stagger className="space-y-4" gap={0.05}>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField label="Full name">
                          <Input
                            value={user ? user.name : name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Alex Morgan"
                            readOnly={!!user}
                          />
                        </FormField>
                        <FormField label="Email">
                          <Input
                            type="email"
                            value={user ? user.email : email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            readOnly={!!user}
                          />
                        </FormField>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField label="Professional headline">
                          <Input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="e.g. Senior Data Scientist" />
                        </FormField>
                        <FormField label="Primary expertise">
                          <Select value={expertiseValue} onValueChange={(v) => v && setExpertise(v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </FormField>
                      </div>
                      <FormField label="Teaching sample or portfolio (optional)">
                        <Input value={sampleUrl} onChange={(e) => setSampleUrl(e.target.value)} placeholder="https://…" />
                      </FormField>
                      <FormField label="Tell us about yourself">
                        <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Your background, experience, and what you'd love to teach…" className="min-h-32" />
                      </FormField>
                    </Stagger>
                    <Magnetic strength={0.15} className="flex w-full">
                      <Button type="submit" size="lg" className="sheen w-full" disabled={submitting}>
                        {submitting ? "Submitting…" : <>Submit application <ArrowRight /></>}
                      </Button>
                    </Magnetic>
                    <p className="text-center text-xs text-muted-foreground">
                      Already applied? <Link href="/instructor" className="text-primary hover:underline">Check your status</Link>
                    </p>
                  </form>
                </CardContent>
              </Card>
            </Reveal>
          )}
        </div>
      </Section>
    </>
  );
}

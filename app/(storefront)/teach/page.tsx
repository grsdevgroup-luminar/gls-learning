"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStore } from "@/lib/context/store";
import { categories } from "@/lib/mock/courses";
import { Section } from "@/components/shared/section";
import { Reveal } from "@/components/shared/motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const { role, currentInstructor, applyAsInstructor, mounted } = useStore();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [expertise, setExpertise] = useState(categories[0]);
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [sampleUrl, setSampleUrl] = useState("");

  const alreadyInstructor = mounted && role === "instructor" && currentInstructor;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !bio.trim()) {
      toast.error("Please fill in your name, email and a short bio.");
      return;
    }
    applyAsInstructor({ name, email, expertise, headline, bio, sampleUrl });
    toast.success("Application submitted! 🎉", { description: "We'll review it within 1–2 business days." });
    router.push("/instructor");
  }

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
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
            <Card variant="elevated">
              <CardHeader>
                <CardTitle className="text-xl">Apply to teach</CardTitle>
                <p className="text-sm text-muted-foreground">Tell us about yourself. Approved instructors can publish courses immediately.</p>
              </CardHeader>
              <CardContent>
                <form onSubmit={submit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Full name</Label>
                      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Morgan" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Email</Label>
                      <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Professional headline</Label>
                      <Input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="e.g. Senior Data Scientist" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Primary expertise</Label>
                      <Select value={expertise} onValueChange={(v) => v && setExpertise(v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Teaching sample or portfolio (optional)</Label>
                    <Input value={sampleUrl} onChange={(e) => setSampleUrl(e.target.value)} placeholder="https://…" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tell us about yourself</Label>
                    <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Your background, experience, and what you'd love to teach…" className="min-h-32" />
                  </div>
                  <Button type="submit" size="lg" className="w-full">Submit application <ArrowRight /></Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Already applied? <Link href="/instructor" className="text-primary hover:underline">Check your status</Link>
                  </p>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </Section>
    </>
  );
}

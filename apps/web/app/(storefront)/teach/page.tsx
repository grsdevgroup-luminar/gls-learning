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
import { applyInstructorSchema } from "@skillstream/shared";

type FieldErrors = Partial<Record<keyof ReturnType<typeof buildPayload>, string>>;

function buildPayload(fields: {
  expertise: string;
  headline: string;
  bio: string;
  sampleUrl: string;
  linkedinUrl: string;
  twitterUrl: string;
  youtubeUrl: string;
  facebookUrl: string;
  otherUrl: string;
}) {
  return {
    expertise: fields.expertise.trim(),
    headline: fields.headline.trim(),
    bio: fields.bio.trim(),
    sampleUrl: fields.sampleUrl.trim() || undefined,
    linkedinUrl: fields.linkedinUrl.trim() || undefined,
    twitterUrl: fields.twitterUrl.trim() || undefined,
    youtubeUrl: fields.youtubeUrl.trim() || undefined,
    facebookUrl: fields.facebookUrl.trim() || undefined,
    otherUrl: fields.otherUrl.trim() || undefined,
  };
}

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
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [otherUrl, setOtherUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const expertiseValue = expertise || categories[0] || "";

  const alreadyInstructor = mounted && role === "instructor";

  function clearError(field: keyof FieldErrors) {
    setFieldErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      toast.error("Please log in first — your application is linked to your account.");
      router.push("/login?next=/teach");
      return;
    }

    const payload = buildPayload({
      expertise: expertiseValue,
      headline,
      bio,
      sampleUrl,
      linkedinUrl,
      twitterUrl,
      youtubeUrl,
      facebookUrl,
      otherUrl,
    });
    const result = applyInstructorSchema.safeParse(payload);
    if (!result.success) {
      const errors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        if (key && !errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    setSubmitting(true);
    try {
      await api.applyInstructor(result.data);
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
              Join GRS Learning&apos;s instructors and turn your expertise into a course that reaches learners everywhere.
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
                  <form onSubmit={submit} noValidate className="space-y-6">
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
                        <FormField label="Professional headline" error={fieldErrors.headline}>
                          <Input
                            value={headline}
                            onChange={(e) => { setHeadline(e.target.value); clearError("headline"); }}
                            placeholder="e.g. Senior Data Scientist"
                            aria-invalid={!!fieldErrors.headline}
                          />
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
                      <FormField label="Teaching sample or portfolio (optional)" error={fieldErrors.sampleUrl}>
                        <Input
                          value={sampleUrl}
                          onChange={(e) => { setSampleUrl(e.target.value); clearError("sampleUrl"); }}
                          placeholder="https://…"
                          aria-invalid={!!fieldErrors.sampleUrl}
                        />
                      </FormField>
                      <FormField label="Tell us about yourself" error={fieldErrors.bio}>
                        <Textarea
                          value={bio}
                          onChange={(e) => { setBio(e.target.value); clearError("bio"); }}
                          placeholder="Your background, experience, and what you'd love to teach…"
                          className="min-h-32"
                          aria-invalid={!!fieldErrors.bio}
                        />
                      </FormField>
                    </Stagger>

                    <div className="space-y-4 border-t border-border pt-6">
                      <div>
                        <h3 className="text-sm font-semibold">Social &amp; portfolio links</h3>
                        <p className="text-xs text-muted-foreground">Optional — help learners and reviewers find you elsewhere.</p>
                      </div>
                      <Stagger className="space-y-4" gap={0.05}>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <FormField label="LinkedIn" error={fieldErrors.linkedinUrl}>
                            <Input
                              value={linkedinUrl}
                              onChange={(e) => { setLinkedinUrl(e.target.value); clearError("linkedinUrl"); }}
                              placeholder="https://linkedin.com/in/username"
                              aria-invalid={!!fieldErrors.linkedinUrl}
                            />
                          </FormField>
                          <FormField label="Twitter / X" error={fieldErrors.twitterUrl}>
                            <Input
                              value={twitterUrl}
                              onChange={(e) => { setTwitterUrl(e.target.value); clearError("twitterUrl"); }}
                              placeholder="https://x.com/username"
                              aria-invalid={!!fieldErrors.twitterUrl}
                            />
                          </FormField>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <FormField label="YouTube" error={fieldErrors.youtubeUrl}>
                            <Input
                              value={youtubeUrl}
                              onChange={(e) => { setYoutubeUrl(e.target.value); clearError("youtubeUrl"); }}
                              placeholder="https://youtube.com/@username"
                              aria-invalid={!!fieldErrors.youtubeUrl}
                            />
                          </FormField>
                          <FormField label="Facebook" error={fieldErrors.facebookUrl}>
                            <Input
                              value={facebookUrl}
                              onChange={(e) => { setFacebookUrl(e.target.value); clearError("facebookUrl"); }}
                              placeholder="https://facebook.com/username"
                              aria-invalid={!!fieldErrors.facebookUrl}
                            />
                          </FormField>
                        </div>
                        <FormField label="Another link of your choice" hint="optional" error={fieldErrors.otherUrl}>
                          <Input
                            value={otherUrl}
                            onChange={(e) => { setOtherUrl(e.target.value); clearError("otherUrl"); }}
                            placeholder="https://yourwebsite.com"
                            aria-invalid={!!fieldErrors.otherUrl}
                          />
                        </FormField>
                      </Stagger>
                    </div>

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


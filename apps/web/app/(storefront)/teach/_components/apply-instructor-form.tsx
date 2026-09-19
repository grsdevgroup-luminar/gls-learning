"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useSession } from "@/lib/api/session";
import { useCategories } from "@/lib/api/hooks";
import { Reveal, Stagger, Magnetic } from "@/components/shared/motion";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowRight, Upload, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { applyInstructorSchema, type InstructorCvUploadDto } from "@skillstream/shared";
import { ApplySocialLinks, type SocialLinkField } from "./apply-social-links";

const OTHER_EXPERTISE = "__other__";
const CV_MAX_BYTES = 5 * 1024 * 1024;
const CV_ACCEPT = ".pdf,.doc,.docx";

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

export function ApplyInstructorForm() {
  const { user } = useSession();
  const router = useRouter();
  const { data: categories = [] } = useCategories();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  // Categories load async, so hold "" and fall back to the first one on render.
  const [expertise, setExpertise] = useState("");
  const [customExpertise, setCustomExpertise] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [sampleUrl, setSampleUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [otherUrl, setOtherUrl] = useState("");
  const [cv, setCv] = useState<InstructorCvUploadDto | null>(null);
  const [uploadingCv, setUploadingCv] = useState(false);
  const cvInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const expertiseValue = expertise || categories[0] || "";
  const isCustomExpertise = expertise === OTHER_EXPERTISE;

  const socialSetters: Record<SocialLinkField, (value: string) => void> = {
    linkedinUrl: setLinkedinUrl,
    twitterUrl: setTwitterUrl,
    youtubeUrl: setYoutubeUrl,
    facebookUrl: setFacebookUrl,
    otherUrl: setOtherUrl,
  };

  async function handleCvPicked(file: File | undefined) {
    if (!file) return;
    if (file.size > CV_MAX_BYTES) {
      toast.error(`CV must be under ${Math.floor(CV_MAX_BYTES / (1024 * 1024))} MB`);
      return;
    }
    setUploadingCv(true);
    try {
      const uploaded = await api.uploadInstructorCv(file);
      setCv(uploaded);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setUploadingCv(false);
    }
  }

  function handleRemoveCv() {
    if (!cv) return;
    const key = cv.key;
    setCv(null);
    // Best-effort: the form already dropped the reference either way, so a
    // failed cleanup call shouldn't block or alarm the applicant.
    api.deleteInstructorCv(key).catch(() => undefined);
  }

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

    const payload = {
      ...buildPayload({
        expertise: isCustomExpertise ? customExpertise : expertiseValue,
        headline,
        bio,
        sampleUrl,
        linkedinUrl,
        twitterUrl,
        youtubeUrl,
        facebookUrl,
        otherUrl,
      }),
      ...(cv ? { cvKey: cv.key, cvName: cv.name, cvSizeLabel: cv.sizeLabel } : {}),
    };
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
    <Reveal y={20}>
      <Card variant="elevated">
        <CardHeader>
          <CardTitle className="text-xl">Apply to teach</CardTitle>
          <p className="text-sm text-muted-foreground">About. Approved instructors can publish courses immediately.</p>
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
                <FormField label="Primary expertise" error={fieldErrors.expertise}>
                  <Select
                    value={expertiseValue}
                    onValueChange={(v) => {
                      if (!v) return;
                      setExpertise(v);
                      clearError("expertise");
                    }}
                  >
                    <SelectTrigger aria-invalid={!!fieldErrors.expertise}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      <SelectItem value={OTHER_EXPERTISE}>Others</SelectItem>
                    </SelectContent>
                  </Select>
                  {isCustomExpertise && (
                    <Input
                      value={customExpertise}
                      onChange={(e) => {
                        setCustomExpertise(e.target.value);
                        clearError("expertise");
                      }}
                      placeholder="Enter your area of expertise"
                      maxLength={80}
                      aria-label="Custom primary expertise"
                      aria-invalid={!!fieldErrors.expertise}
                    />
                  )}
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
              <FormField label="About" error={fieldErrors.bio}>
                <Textarea
                  value={bio}
                  onChange={(e) => { setBio(e.target.value); clearError("bio"); }}
                  placeholder="Your background, experience, and what you'd love to teach…"
                  className="min-h-32"
                  aria-invalid={!!fieldErrors.bio}
                />
              </FormField>
              <FormField label="Resume / CV" hint="optional">
                <input
                  ref={cvInputRef}
                  type="file"
                  accept={CV_ACCEPT}
                  className="hidden"
                  onChange={(e) => {
                    handleCvPicked(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingCv}
                    onClick={() => cvInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    {uploadingCv ? "Uploading…" : cv ? "Replace file" : "Upload CV"}
                  </Button>
                  {cv && (
                    <>
                      <span className="inline-flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
                        <FileText className="h-4 w-4 shrink-0" />
                        <span className="truncate">{cv.name}</span>
                        <span className="shrink-0 text-xs">({cv.sizeLabel})</span>
                      </span>
                      <Button type="button" variant="ghost" size="sm" onClick={handleRemoveCv}>
                        <Trash2 className="h-4 w-4" /> Remove
                      </Button>
                    </>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">PDF, DOC, or DOCX — up to 5 MB.</p>
              </FormField>
            </Stagger>

            <ApplySocialLinks
              values={{ linkedinUrl, twitterUrl, youtubeUrl, facebookUrl, otherUrl }}
              errors={fieldErrors}
              onChange={(field, value) => {
                socialSetters[field](value);
                clearError(field);
              }}
            />

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
  );
}

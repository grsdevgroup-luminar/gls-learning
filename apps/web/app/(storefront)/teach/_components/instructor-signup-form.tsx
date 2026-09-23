"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useRegisterInstructor } from "@/lib/api/session";
import { useCategories } from "@/lib/api/hooks";
import { ApiError } from "@/lib/api/errors";
import { Reveal, Stagger, Magnetic } from "@/components/shared/motion";
import { FormField } from "@/components/shared/form-field";
import { CountryField } from "@/components/shared/country-field";
import { PhoneInput } from "@/components/shared/phone-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { instructorSignupSchema } from "@skillstream/shared";
import { ApplySocialLinks, type SocialLinkField } from "./apply-social-links";
import { PasswordRequirements } from "@/components/shared/password-requirements";

const OTHER_EXPERTISE = "__other__";

type FieldErrors = Partial<Record<keyof ReturnType<typeof buildPayload>, string>>;

function buildPayload(fields: {
  name: string;
  email: string;
  password: string;
  country: string;
  phone: string;
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
    name: fields.name.trim(),
    email: fields.email.trim(),
    password: fields.password,
    country: fields.country,
    phone: fields.phone.trim(),
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

/** The dedicated instructor journey: creates the account and submits the
 *  application in a single step, so applying to teach never requires first
 *  creating (or logging into) a separate student account. */
export function InstructorSignupForm() {
  const router = useRouter();
  const registerInstructor = useRegisterInstructor();
  const { data: categories = [] } = useCategories();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");
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
    const payload = buildPayload({
      name, email, password, country, phone,
      expertise: isCustomExpertise ? customExpertise : expertiseValue,
      headline, bio, sampleUrl,
      linkedinUrl, twitterUrl, youtubeUrl, facebookUrl, otherUrl,
    });
    const result = instructorSignupSchema.safeParse(payload);
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
      await registerInstructor.mutateAsync(result.data);
      toast.success("Application submitted! 🎉", { description: "We'll review it within 1–2 business days." });
      router.push("/instructor");
    } catch (err) {
      const message = err instanceof ApiError ? err.displayMessage : "Could not submit your application";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Reveal y={20}>
      <Card variant="elevated">
        <CardHeader>
          <CardTitle className="text-xl">Create your instructor account</CardTitle>
          <p className="text-sm text-muted-foreground">One step: your account and your application. Approved instructors can publish courses immediately.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} noValidate className="space-y-6">
            <Stagger className="space-y-4" gap={0.05}>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label={<>Full name <span className="text-destructive" aria-hidden="true">*</span></>} error={fieldErrors.name}>
                  <Input
                    value={name}
                    onChange={(e) => { setName(e.target.value); clearError("name"); }}
                    placeholder="Alex Morgan"
                    aria-invalid={!!fieldErrors.name}
                  />
                </FormField>
                <FormField label={<>Email <span className="text-destructive" aria-hidden="true">*</span></>} error={fieldErrors.email}>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value.toLowerCase()); clearError("email"); }}
                    placeholder="you@example.com"
                    autoComplete="email"
                    aria-invalid={!!fieldErrors.email}
                  />
                </FormField>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label={<>Password <span className="text-destructive" aria-hidden="true">*</span></>} error={fieldErrors.password}>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a password (min 8 chars)"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); clearError("password"); }}
                      aria-invalid={!!fieldErrors.password}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-8 w-9 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((current) => !current)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </FormField>
                <FormField label={<>Country <span className="text-destructive" aria-hidden="true">*</span></>} error={fieldErrors.country}>
                  <CountryField
                    value={country}
                    onChange={(code) => { setCountry(code); clearError("country"); }}
                  />
                </FormField>
                <PasswordRequirements value={password} />
              </div>
              <FormField label={<>Phone <span className="text-destructive" aria-hidden="true">*</span></>} error={fieldErrors.phone} hint="Calling code follows your country">
                <PhoneInput country={country} value={phone} onChange={(value) => { setPhone(value); clearError("phone"); }} />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label={<>Professional headline <span className="text-destructive" aria-hidden="true">*</span></>} error={fieldErrors.headline}>
                  <Input
                    value={headline}
                    onChange={(e) => { setHeadline(e.target.value); clearError("headline"); }}
                    placeholder="e.g. Senior Data Scientist"
                    aria-invalid={!!fieldErrors.headline}
                  />
                </FormField>
                <FormField label={<>Primary expertise <span className="text-destructive" aria-hidden="true">*</span></>} error={fieldErrors.expertise}>
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
              <FormField label={<>About <span className="text-destructive" aria-hidden="true">*</span></>} error={fieldErrors.bio}>
                <Textarea
                  value={bio}
                  onChange={(e) => { setBio(e.target.value); clearError("bio"); }}
                  placeholder="Your background, experience, and what you'd love to teach…"
                  className="min-h-32"
                  aria-invalid={!!fieldErrors.bio}
                />
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
                {submitting ? "Submitting…" : <>Create account &amp; apply <ArrowRight /></>}
              </Button>
            </Magnetic>
            <p className="text-center text-xs text-muted-foreground">
              By continuing you agree to our Terms &amp; Privacy Policy. A CV can be added afterward from your application status page.
            </p>
          </form>
        </CardContent>
      </Card>
    </Reveal>
  );
}

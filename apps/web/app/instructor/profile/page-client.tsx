"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, instructorApi } from "@/lib/api/endpoints";
import { apiFetch, apiFetchMultipart } from "@/lib/api/client";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useCategories } from "@/lib/api/hooks";
import { useSession, SESSION_QUERY_KEY } from "@/lib/api/session";
import {
  updateInstructorProfileSchema,
  type UpdateInstructorProfileInput,
  isIsoCountryCode,
  isValidPhone,
  passwordSchema,
} from "@skillstream/shared";
import { ApprovalGate } from "../_components/approval-gate";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Reveal, Stagger, Magnetic } from "@/components/shared/motion";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CountrySelect } from "@/components/shared/country-select";
import { PhoneInput } from "@/components/shared/phone-input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { initials } from "@/lib/format";
import { Save, ShieldCheck, Clock, Upload, Trash2, Lock, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { FormSkeleton, PageHeaderSkeleton } from "@/components/shared/loading-skeletons";

// Kept in sync with AVATAR_MAX_BYTES on the API.
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const AVATAR_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

type LinkField = "sampleUrl" | "linkedinUrl" | "twitterUrl" | "youtubeUrl" | "facebookUrl" | "otherUrl";
type FieldErrors = Partial<Record<LinkField, string>>;

export default function InstructorProfile() {
  const qc = useQueryClient();
  const { user } = useSession();
  const { data: profile, isLoading } = useQuery({
    queryKey: ["instructor", "profile"],
    queryFn: instructorApi.profile,
  });

  const { data: categories = [] } = useCategories();

  const [title, setTitle] = useState("");
  const [expertise, setExpertise] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("");
  const [sampleUrl, setSampleUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [otherUrl, setOtherUrl] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  // Categories load async; fall back to the first once they arrive.
  const expertiseValue = expertise || categories[0] || "";

  function clearError(field: LinkField) {
    setFieldErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  // Seed the form once the profile loads — adjusting state during render
  // instead of syncing in an effect. `prevProfile` must NOT initialize from
  // `profile` itself: if the query is already warm in the cache when this
  // component mounts (e.g. client-side nav from a page that primed the same
  // query key), `profile` is non-null on the very first render, so seeding
  // from it would make `prevProfile === profile` immediately — skipping the
  // seed below forever and leaving every field stuck at its initial value.
  const [prevProfile, setPrevProfile] = useState<typeof profile>();
  if (profile && profile !== prevProfile) {
    setPrevProfile(profile);
    setTitle(profile.title ?? "");
    setExpertise(profile.expertise ?? "");
    setBio(profile.bio ?? "");
    setAvatar(profile.avatar ?? "");
    setSampleUrl(profile.sampleUrl ?? "");
    setLinkedinUrl(profile.linkedinUrl ?? "");
    setTwitterUrl(profile.twitterUrl ?? "");
    setYoutubeUrl(profile.youtubeUrl ?? "");
    setFacebookUrl(profile.facebookUrl ?? "");
    setOtherUrl(profile.otherUrl ?? "");
  }

  const saveMutation = useMutation({
    mutationFn: (input: UpdateInstructorProfileInput) => api.updateInstructorProfile(input),
    onSuccess: () => {
      toast.success("Profile saved");
      void qc.invalidateQueries({ queryKey: ["instructor", "profile"] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  function handleSave() {
    const payload = {
      title: title.trim(),
      bio: bio.trim(),
      expertise: expertiseValue,
      sampleUrl: sampleUrl.trim(),
      linkedinUrl: linkedinUrl.trim(),
      twitterUrl: twitterUrl.trim(),
      youtubeUrl: youtubeUrl.trim(),
      facebookUrl: facebookUrl.trim(),
      otherUrl: otherUrl.trim(),
    };
    const result = updateInstructorProfileSchema.safeParse(payload);
    if (!result.success) {
      const errors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as LinkField;
        if (key && !errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    saveMutation.mutate(result.data);
  }

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAvatar = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return apiFetchMultipart<{ avatar: string | null }>("/auth/me/avatar", form);
    },
    onSuccess: (next) => {
      setAvatar(next.avatar ?? "");
      void qc.invalidateQueries({ queryKey: ["instructor", "profile"] });
      void qc.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      toast.success("Photo updated");
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
  const deleteAvatar = useMutation({
    mutationFn: () =>
      apiFetch<{ avatar: string | null }>("/auth/me/avatar", { method: "DELETE" }),
    onSuccess: (next) => {
      setAvatar(next.avatar ?? "");
      void qc.invalidateQueries({ queryKey: ["instructor", "profile"] });
      void qc.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      toast.success("Photo removed");
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  function handleFilePicked(file: File | undefined) {
    if (!file) return;
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error(`Photo must be under ${Math.floor(AVATAR_MAX_BYTES / (1024 * 1024))} MB`);
      return;
    }
    uploadAvatar.mutate(file);
  }

  // Contact (country/phone) — lives on the User record, not the instructor
  // profile, so it's saved through the same generic endpoint the student
  // Account page uses. Seeded from the session the same guarded way as the
  // instructor fields above.
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");
  const [prevUser, setPrevUser] = useState<typeof user>();
  if (user && user !== prevUser) {
    setPrevUser(user);
    setCountry(user.country && isIsoCountryCode(user.country) ? user.country : "");
    setPhone(user.phone ?? "");
  }

  const contactMutation = useMutation({
    mutationFn: () =>
      apiFetch<void>("/auth/me/profile", {
        method: "PATCH",
        body: { name: user?.name ?? "", country: country || null, phone: phone.trim() || null },
      }),
    onSuccess: () => {
      toast.success("Contact info saved");
      void qc.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  function handleContactSave() {
    if (!phone.trim()) {
      toast.error("Please enter your phone number.");
      return;
    }
    if (!country) {
      toast.error("Please select your country so we can validate your phone number.");
      return;
    }
    if (!isValidPhone(phone.trim())) {
      toast.error("Please enter a valid phone number for the selected country.");
      return;
    }
    contactMutation.mutate();
  }

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordMutation = useMutation({
    mutationFn: () =>
      apiFetch<void>("/auth/me/password", { method: "POST", body: { currentPassword, newPassword } }),
    onSuccess: () => {
      toast.success("Password updated");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  function handlePasswordSave() {
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (currentPassword === newPassword) {
      toast.error("New password must be different from your current password");
      return;
    }
    const result = passwordSchema.safeParse(newPassword);
    if (!result.success) {
      toast.error(result.error.issues[0]?.message ?? "Password does not meet the requirements");
      return;
    }
    passwordMutation.mutate();
  }

  // ApprovalGate itself queries ["instructor", "profile"] (same key, shared
  // cache) and shows the not-applied/pending/rejected notice for anyone who
  // isn't APPROVED — so the skeleton and form below only ever render for an
  // approved instructor, once `profile` is guaranteed non-null.
  if (isLoading || !profile) {
    return (
      <ApprovalGate>
        <div className="mx-auto max-w-3xl space-y-6 p-6 md:p-10">
          <PageHeaderSkeleton />
          <div className="rounded-xl border p-6"><FormSkeleton /></div>
        </div>
      </ApprovalGate>
    );
  }
  const status = profile.status;

  return (
    <ApprovalGate>
      <div className="mx-auto max-w-3xl space-y-6 p-6 pb-28 md:p-10 md:pb-28">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight">Instructor profile</h1>
            <p className="text-sm text-muted-foreground">How learners see you across the marketplace.</p>
          </div>
          <Badge
            variant="outline"
            className={status === "APPROVED" ? "gap-1 text-success border-success/30 bg-success/10" : "gap-1 text-warning border-warning/30 bg-warning/10"}
          >
            {status === "APPROVED" ? <ShieldCheck className="size-3" /> : <Clock className="size-3" />}
            {status === "APPROVED" ? "Approved instructor" : status === "PENDING" ? "Pending approval" : "Not approved"}
          </Badge>
        </header>

        <Reveal y={20}>
          <Card>
            <CardHeader><CardTitle className="text-base">Photo</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap items-center gap-4">
              <Avatar className="size-16 ring-1 ring-border transition-transform duration-300 hover:scale-105">
                {avatar && <AvatarImage src={avatar} alt="" />}
                <AvatarFallback className="brand-gradient text-xl text-white">{initials(profile.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="font-heading text-lg font-semibold">{profile.name}</div>
                <div className="text-sm text-muted-foreground">{title || "Your professional headline"}</div>
              </div>
              <div className="flex flex-col items-start gap-2 sm:items-end">
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={AVATAR_ACCEPT}
                    className="hidden"
                    onChange={(e) => {
                      handleFilePicked(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadAvatar.isPending}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    {uploadAvatar.isPending ? "Uploading…" : avatar ? "Change photo" : "Upload photo"}
                  </Button>
                  {avatar && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={deleteAvatar.isPending}
                      onClick={() => deleteAvatar.mutate()}
                    >
                      <Trash2 className="h-4 w-4" />
                      {deleteAvatar.isPending ? "Removing…" : "Remove"}
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">PNG, JPG, WebP, or GIF. Max 5 MB.</p>
              </div>
            </CardContent>
          </Card>
        </Reveal>

        <Reveal y={20} delay={0.06}>
          <Card>
            <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Stagger className="space-y-4" gap={0.05}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Full name">
                    <Input value={profile.name} readOnly className="opacity-70" />
                  </FormField>
                  <FormField label="Email">
                    <Input value={profile.email} readOnly className="opacity-70" />
                  </FormField>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Headline">
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Senior Frontend Engineer" />
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
                <FormField label="Bio">
                  <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell learners about your background and what you teach…" className="min-h-32" />
                </FormField>
              </Stagger>
            </CardContent>
          </Card>
        </Reveal>

        <Reveal y={20} delay={0.09}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contact</CardTitle>
              <CardDescription>Used for account security and SMS reminders — not shown publicly.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Stagger className="grid gap-4 sm:grid-cols-2" gap={0.05}>
                <FormField label="Country" hint="Sets your phone's calling code">
                  <CountrySelect value={country} onChange={setCountry} />
                </FormField>
                <FormField label="Phone" hint="For SMS reminders">
                  <PhoneInput country={country} value={phone} onChange={setPhone} />
                </FormField>
              </Stagger>
              <Button
                variant="outline"
                disabled={contactMutation.isPending}
                onClick={handleContactSave}
              >
                {contactMutation.isPending ? "Saving…" : "Save changes"}
              </Button>
            </CardContent>
          </Card>
        </Reveal>

        <Reveal y={20} delay={0.12}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Social &amp; portfolio links</CardTitle>
              <p className="text-sm text-muted-foreground">Shown on your public instructor page. Leave any field blank to hide it.</p>
            </CardHeader>
            <CardContent className="space-y-4">
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
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Portfolio / teaching sample" error={fieldErrors.sampleUrl}>
                    <Input
                      value={sampleUrl}
                      onChange={(e) => { setSampleUrl(e.target.value); clearError("sampleUrl"); }}
                      placeholder="https://…"
                      aria-invalid={!!fieldErrors.sampleUrl}
                    />
                  </FormField>
                  <FormField label="Another link of your choice" error={fieldErrors.otherUrl}>
                    <Input
                      value={otherUrl}
                      onChange={(e) => { setOtherUrl(e.target.value); clearError("otherUrl"); }}
                      placeholder="https://yourwebsite.com"
                      aria-invalid={!!fieldErrors.otherUrl}
                    />
                  </FormField>
                </div>
              </Stagger>
            </CardContent>
          </Card>
        </Reveal>

        <Reveal y={20} delay={0.15}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Lock className="h-4 w-4 text-primary" /> Password
              </CardTitle>
              <CardDescription>Choose a strong password of at least 8 characters.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Stagger className="grid gap-4 sm:grid-cols-2" gap={0.05}>
                <FormField label="Current password" className="sm:col-span-2">
                  <div className="relative">
                    <Input
                      id="current-password"
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-8 w-9 text-muted-foreground hover:text-foreground"
                      aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                      aria-pressed={showCurrentPassword}
                      aria-controls="current-password"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setShowCurrentPassword((v) => !v)}
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </FormField>
                <FormField label="New password">
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-8 w-9 text-muted-foreground hover:text-foreground"
                      aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                      aria-pressed={showNewPassword}
                      aria-controls="new-password"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setShowNewPassword((v) => !v)}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </FormField>
                <FormField label="Confirm new password">
                  <div className="relative">
                    <Input
                      id="confirm-new-password"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-8 w-9 text-muted-foreground hover:text-foreground"
                      aria-label={showConfirmPassword ? "Hide confirmation password" : "Show confirmation password"}
                      aria-pressed={showConfirmPassword}
                      aria-controls="confirm-new-password"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setShowConfirmPassword((v) => !v)}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </FormField>
              </Stagger>
              <Button
                variant="outline"
                disabled={passwordMutation.isPending || !currentPassword || !newPassword}
                onClick={handlePasswordSave}
              >
                {passwordMutation.isPending ? "Updating…" : "Update password"}
              </Button>
            </CardContent>
          </Card>
        </Reveal>
      </div>

      {/* Fixed so "Save profile" stays reachable without scrolling past five
          cards — sticky wouldn't help here since it only pins once its own
          natural position nears the viewport edge. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur supports-backdrop-filter:bg-background/85 md:left-64 md:px-8">
        <div className="mx-auto flex max-w-3xl items-center justify-end gap-4">
          <Magnetic strength={0.15}>
            <Button className="sheen" onClick={handleSave} disabled={saveMutation.isPending}>
              <Save /> {saveMutation.isPending ? "Saving…" : "Save profile"}
            </Button>
          </Magnetic>
        </div>
      </div>
    </ApprovalGate>
  );
}

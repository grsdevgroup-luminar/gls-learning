"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, instructorApi } from "@/lib/api/endpoints";
import { apiFetch, apiFetchMultipart } from "@/lib/api/client";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useCategories } from "@/lib/api/hooks";
import { SESSION_QUERY_KEY } from "@/lib/api/session";
import { updateInstructorProfileSchema, type UpdateInstructorProfileInput } from "@skillstream/shared";
import { ApprovalGate } from "../_components/approval-gate";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Clock } from "lucide-react";
import { toast } from "sonner";
import { FormSkeleton, PageHeaderSkeleton } from "@/components/shared/loading-skeletons";
import { PhotoCard } from "./_components/photo-card";
import { DetailsCard } from "./_components/details-card";
import { ContactCard } from "./_components/contact-card";
import { SocialLinksCard, type LinkField } from "./_components/social-links-card";
import { PasswordCard } from "./_components/password-card";
import { SaveBar } from "./_components/save-bar";

// Kept in sync with AVATAR_MAX_BYTES on the API.
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

type FieldErrors = Partial<Record<LinkField | "title", string>>;

export default function InstructorProfile() {
  const qc = useQueryClient();
  const { data: profile, isLoading } = useQuery({
    queryKey: ["instructor", "profile"],
    queryFn: instructorApi.profile,
    refetchOnMount: "always",
  });

  const { data: categories = [] } = useCategories();

  const [requestedName, setRequestedName] = useState("");
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

  function clearError(field: LinkField | "title") {
    setFieldErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  const linkSetters: Record<LinkField, (value: string) => void> = {
    sampleUrl: setSampleUrl,
    linkedinUrl: setLinkedinUrl,
    twitterUrl: setTwitterUrl,
    youtubeUrl: setYoutubeUrl,
    facebookUrl: setFacebookUrl,
    otherUrl: setOtherUrl,
  };
  function handleLinkChange(field: LinkField, value: string) {
    linkSetters[field](value);
    clearError(field);
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
    setRequestedName(profile.pendingNameChange?.requestedName ?? profile.name);
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

  const nameChangeMutation = useMutation({
    mutationFn: () => instructorApi.requestInstructorNameChange(requestedName.trim()),
    onSuccess: () => {
      toast.success("Name-change request submitted", { description: "An admin must approve it before your profile changes." });
      void qc.invalidateQueries({ queryKey: ["instructor", "profile"] });
      void qc.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
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
        const key = issue.path[0] as LinkField | "title";
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

  // ApprovalGate itself queries ["instructor", "profile"] (same key, shared
  // cache) and shows the not-applied/pending/rejected notice for anyone who
  // isn't APPROVED — so the skeleton and form below only ever render for an
  // approved instructor, once `profile` is guaranteed non-null.
  if (isLoading || !profile) {
    return (
      <ApprovalGate>
        <div className="space-y-6 p-6 md:p-8">
          <PageHeaderSkeleton />
          <div className="rounded-xl border p-6"><FormSkeleton /></div>
        </div>
      </ApprovalGate>
    );
  }
  const status = profile.status;

  return (
    <ApprovalGate>
      <div className="space-y-6 p-6 pb-28 md:p-8 md:pb-28">
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

        <PhotoCard
          name={profile.name}
          title={title}
          avatar={avatar}
          fileInputRef={fileInputRef}
          onFilePicked={handleFilePicked}
          onRemove={() => deleteAvatar.mutate()}
          uploading={uploadAvatar.isPending}
          removing={deleteAvatar.isPending}
        />

        <DetailsCard
          profileName={profile.name}
          profileEmail={profile.email}
          requestedName={requestedName}
          pendingNameChange={profile.pendingNameChange}
          lastRejectedNameChange={profile.lastRejectedNameChange}
          onRequestedNameChange={setRequestedName}
          onRequestNameChange={() => nameChangeMutation.mutate()}
          requestingNameChange={nameChangeMutation.isPending}
          title={title}
          onTitleChange={(v) => { setTitle(v); clearError("title"); }}
          titleError={fieldErrors.title}
          expertiseValue={expertiseValue}
          onExpertiseChange={setExpertise}
          categories={categories}
          bio={bio}
          onBioChange={setBio}
        />

        <ContactCard />

        <SocialLinksCard
          values={{ sampleUrl, linkedinUrl, twitterUrl, youtubeUrl, facebookUrl, otherUrl }}
          errors={fieldErrors}
          onChange={handleLinkChange}
        />

        <PasswordCard />
      </div>

      <SaveBar pending={saveMutation.isPending} onSave={handleSave} />
    </ApprovalGate>
  );
}

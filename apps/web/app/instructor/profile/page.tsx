"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AuthUserDto } from "@skillstream/shared";
import { api, instructorApi } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useCategories } from "@/lib/api/hooks";
import { useSession, SESSION_QUERY_KEY } from "@/lib/api/session";
import { apiFetch, apiFetchMultipart } from "@/lib/api/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Reveal, Stagger, Magnetic } from "@/components/shared/motion";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { initials } from "@/lib/format";
import { Save, ShieldCheck, Clock, Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { FormSkeleton, PageHeaderSkeleton } from "@/components/shared/loading-skeletons";

// Kept in sync with AVATAR_MAX_BYTES on the API.
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const AVATAR_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

export default function InstructorProfile() {
  const qc = useQueryClient();
  const { user: sessionUser } = useSession();
  const { data: profile, isLoading } = useQuery({
    queryKey: ["instructor", "profile"],
    queryFn: instructorApi.profile,
  });

  const { data: categories = [] } = useCategories();

  const [title, setTitle] = useState("");
  const [expertise, setExpertise] = useState("");
  const [bio, setBio] = useState("");
  // Categories load async; fall back to the first once they arrive.
  const expertiseValue = expertise || categories[0] || "";

  // Seed the form once the profile loads — adjusting state during render
  // instead of syncing in an effect.
  const [prevProfile, setPrevProfile] = useState(profile);
  if (profile && profile !== prevProfile) {
    setPrevProfile(profile);
    setTitle(profile.title ?? "");
    setExpertise(profile.expertise ?? "");
    setBio(profile.bio ?? "");
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      api.updateInstructorProfile({ title, bio, expertise: expertiseValue }),
    onSuccess: () => {
      toast.success("Profile saved");
      void qc.invalidateQueries({ queryKey: ["instructor", "profile"] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  // Avatar upload / delete — same endpoint as /account so the photo is one
  // canonical field on the user, not per-role.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAvatar = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return apiFetchMultipart<AuthUserDto>("/auth/me/avatar", form);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      toast.success("Photo updated");
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
  const deleteAvatar = useMutation({
    mutationFn: () =>
      apiFetch<AuthUserDto>("/auth/me/avatar", { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      toast.success("Photo removed");
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  function handleFilePicked(file: File | undefined) {
    if (!file) return;
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error(
        `Photo must be under ${Math.floor(AVATAR_MAX_BYTES / (1024 * 1024))} MB`,
      );
      return;
    }
    uploadAvatar.mutate(file);
  }

  if (isLoading || !profile) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-6 md:p-10">
        <PageHeaderSkeleton />
        <div className="rounded-xl border p-6"><FormSkeleton /></div>
      </div>
    );
  }
  const status = profile.status;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 md:p-10">
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
          <CardContent className="flex flex-wrap items-start gap-4 pt-6">
            <div className="flex flex-col items-center gap-2">
              <Avatar className="size-16 ring-1 ring-border transition-transform duration-300 hover:scale-105">
                {sessionUser?.avatar && <AvatarImage src={sessionUser.avatar} alt="" />}
                <AvatarFallback className="brand-gradient text-xl text-white">{initials(profile.name)}</AvatarFallback>
              </Avatar>
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
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadAvatar.isPending}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  {uploadAvatar.isPending
                    ? "Uploading…"
                    : sessionUser?.avatar
                      ? "Change"
                      : "Upload"}
                </Button>
                {sessionUser?.avatar && (
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
              <p className="text-center text-xs text-muted-foreground">
                PNG, JPG, WebP, GIF. Max 5 MB.
              </p>
            </div>
            <div className="min-w-0 flex-1 pt-1">
              <div className="font-heading text-lg font-semibold">{profile.name}</div>
              <div className="text-sm text-muted-foreground">{title || "Your professional headline"}</div>
            </div>
          </CardContent>
        </Card>
      </Reveal>

      <Reveal y={20} delay={0.08}>
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
            <div className="flex justify-end">
              <Magnetic strength={0.15}>
                <Button className="sheen" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  <Save /> {saveMutation.isPending ? "Saving…" : "Save profile"}
                </Button>
              </Magnetic>
            </div>
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}

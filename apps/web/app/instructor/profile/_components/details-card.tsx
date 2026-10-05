"use client";

import { Reveal, Stagger } from "@/components/shared/motion";
import { FormField } from "@/components/shared/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { InstructorNameChangeRequestDto, InstructorExpertiseChangeRequestDto } from "@/lib/api/endpoints";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// Kept in sync with updateInstructorProfileSchema's max lengths.
export const HEADLINE_MAX_LENGTH = 160;
export const BIO_MAX_LENGTH = 4000;

export function DetailsCard({
  profileName,
  profileEmail,
  requestedName,
  pendingNameChange,
  pendingExpertiseChange,
  lastRejectedNameChange,
  onRequestedNameChange,
  onRequestNameChange,
  requestingNameChange,
  title,
  onTitleChange,
  titleError,
  profileExpertise,
  expertiseValue,
  onExpertiseChange,
  onRequestExpertiseChange,
  requestingExpertiseChange,
  categories,
  bio,
  onBioChange,
}: {
  profileName: string;
  profileEmail: string;
  requestedName: string;
  pendingNameChange?: InstructorNameChangeRequestDto | null;
  pendingExpertiseChange?: InstructorExpertiseChangeRequestDto | null;
  lastRejectedNameChange?: InstructorNameChangeRequestDto | null;
  onRequestedNameChange: (value: string) => void;
  onRequestNameChange: () => void;
  requestingNameChange: boolean;
  title: string;
  onTitleChange: (value: string) => void;
  titleError?: string;
  profileExpertise: string;
  expertiseValue: string;
  onExpertiseChange: (value: string) => void;
  onRequestExpertiseChange: () => void;
  requestingExpertiseChange: boolean;
  categories: string[];
  bio: string;
  onBioChange: (value: string) => void;
}) {
  return (
    <Reveal y={20} delay={0.06}>
      <Card>
        <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Stagger className="space-y-4" gap={0.05}>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Full name" hint={pendingNameChange ? "Profile review pending" : "Name changes require profile review"}>
                <Input
                  value={requestedName}
                  onChange={(e) => onRequestedNameChange(e.target.value)}
                  disabled={!!pendingNameChange || requestingNameChange}
                  maxLength={120}
                />
                {pendingNameChange && (
                  <p className="mt-1 text-xs text-warning">
                    Requested: {pendingNameChange.requestedName}. Your current name, instructor access, courses, students, and earnings remain unchanged until approval.
                  </p>
                )}
                {!pendingNameChange && requestedName.trim() !== profileName && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    disabled={!requestedName.trim() || requestingNameChange}
                    onClick={onRequestNameChange}
                  >
                    {requestingNameChange ? "Submitting…" : "Request name change"}
                  </Button>
                )}
                {!pendingNameChange && lastRejectedNameChange && (
                  <div className="mt-2 rounded-lg border border-destructive/20 bg-destructive/5 p-2.5 text-xs">
                    <p className="font-medium text-destructive">
                      Your request to change your name to &quot;{lastRejectedNameChange.requestedName}&quot; wasn&apos;t approved
                    </p>
                    {lastRejectedNameChange.note && (
                      <p className="mt-1 text-muted-foreground">{lastRejectedNameChange.note}</p>
                    )}
                  </div>
                )}
              </FormField>
              <FormField label="Email">
                <Input value={profileEmail} readOnly className="opacity-70" />
              </FormField>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Headline" error={titleError}>
                <Input
                  value={title}
                  required
                  maxLength={HEADLINE_MAX_LENGTH}
                  onChange={(e) => onTitleChange(e.target.value)}
                  placeholder="e.g. Senior Frontend Engineer"
                  aria-invalid={!!titleError}
                />
                <div className="mt-1 text-right text-xs text-muted-foreground">
                  {title.length} / {HEADLINE_MAX_LENGTH} characters
                </div>
              </FormField>
              <FormField label="Primary expertise" hint={pendingExpertiseChange ? "Profile review pending" : "Expertise changes require admin approval"}>
                <Select value={expertiseValue} onValueChange={(v) => v && onExpertiseChange(v)} disabled={!!pendingExpertiseChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                {pendingExpertiseChange && (
                  <p className="mt-1 text-xs text-warning">
                    Requested: {pendingExpertiseChange.requestedExpertise}. Your current expertise remains unchanged until approval.
                  </p>
                )}
                {!pendingExpertiseChange && expertiseValue !== profileExpertise && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    disabled={!expertiseValue || requestingExpertiseChange}
                    onClick={onRequestExpertiseChange}
                  >
                    {requestingExpertiseChange ? "Submitting..." : "Request expertise change"}
                  </Button>
                )}              </FormField>
            </div>
            <FormField label="About">
              <Textarea
                value={bio}
                maxLength={BIO_MAX_LENGTH}
                onChange={(e) => onBioChange(e.target.value)}
                placeholder="Tell learners about your background and what you teach…"
                className="h-32 min-h-32 max-h-32 resize-none overflow-y-auto"
              />
              <div className="mt-1 text-right text-xs text-muted-foreground">
                {bio.length.toLocaleString()} / {BIO_MAX_LENGTH.toLocaleString()} characters
              </div>
            </FormField>
          </Stagger>
        </CardContent>
      </Card>
    </Reveal>
  );
}

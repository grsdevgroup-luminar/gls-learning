"use client";

import {
  MAX_COURSE_DESCRIPTION_LENGTH,
  ISO_STANDARD_OPTIONS,
} from "@grslearning/shared";
import { CategoryPicker } from "@/components/shared/category-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BookOpen } from "lucide-react";

const MAX_SUBTITLE_LENGTH = 240;
const MAX_TITLE_LENGTH = 100;

export function CourseDetailsForm({
  title,
  subtitle,
  categoryValue,
  level,
  levelOptions,
  isoStandard,
  customIsoStandard,
  description,
  titleTooLong,
  subtitleTooLong,
  descriptionTooLong,
  canManage,
  onTitleChange,
  onSubtitleChange,
  onCategoryChange,
  onLevelChange,
  onIsoStandardChange,
  onCustomIsoStandardChange,
  onDescriptionChange,
}: {
  title: string;
  subtitle: string;
  categoryValue: string;
  level: string;
  levelOptions: readonly string[];
  isoStandard: string;
  customIsoStandard: string;
  description: string;
  titleTooLong: boolean;
  subtitleTooLong: boolean;
  descriptionTooLong: boolean;
  canManage: boolean;
  onTitleChange: (value: string) => void;
  onSubtitleChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onLevelChange: (value: string) => void;
  onIsoStandardChange: (value: string) => void;
  onCustomIsoStandardChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
}) {
  return (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BookOpen className="h-4 w-4 text-primary" /> Course details
                </CardTitle>
                <p className="text-xs text-muted-foreground">Fields marked with <span className="font-semibold text-destructive" aria-hidden="true">*</span> are required.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="course-title">Title <span className="text-destructive" aria-hidden="true">*</span></Label>
                    <span
                      className={
                        titleTooLong
                          ? "text-xs font-medium text-destructive"
                          : "text-xs text-muted-foreground"
                      }
                    >
                      {title.length}/{MAX_TITLE_LENGTH}
                    </span>
                  </div>
                  <Input
                    id="course-title"
                    value={title}
                    onChange={(e) => onTitleChange(e.target.value)}
                    placeholder="One-line value proposition"
                    required
                    aria-required="true"
                    aria-invalid={titleTooLong}
                    aria-describedby={
                      titleTooLong ? "course-title-error" : undefined
                    }
                  />
                  {titleTooLong && (
                    <p
                      id="course-title-error"
                      className="text-xs font-medium text-destructive"
                      role="alert"
                    >
                      Title cannot exceed {MAX_TITLE_LENGTH} characters
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="course-subtitle">Subtitle <span className="text-destructive" aria-hidden="true">*</span></Label>
                    <span
                      className={
                        subtitleTooLong
                          ? "text-xs font-medium text-destructive"
                          : "text-xs text-muted-foreground"
                      }
                    >
                      {subtitle.length}/{MAX_SUBTITLE_LENGTH}
                    </span>
                  </div>
                  <Input
                    id="course-subtitle"
                    value={subtitle}
                    onChange={(e) => onSubtitleChange(e.target.value)}
                    placeholder="One-line value proposition"
                    required
                    aria-required="true"
                    aria-invalid={subtitleTooLong}
                    aria-describedby={
                      subtitleTooLong ? "course-subtitle-error" : undefined
                    }
                  />
                  {subtitleTooLong && (
                    <p
                      id="course-subtitle-error"
                      className="text-xs font-medium text-destructive"
                      role="alert"
                    >
                      Subtitle cannot exceed 240 characters
                    </p>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Category <span className="text-destructive" aria-hidden="true">*</span></Label>
                    <CategoryPicker
                      value={categoryValue}
                      onChange={onCategoryChange}
                      canManage={canManage}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Level</Label>
                    <Select
                      value={level}
                      onValueChange={(v) =>
                        v && onLevelChange(v)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {levelOptions.map((l) => (
                          <SelectItem key={l} value={l}>
                            {l}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="course-iso-standard">ISO Standard <span className="text-destructive" aria-hidden="true">*</span></Label>
                  <Select
                    value={isoStandard}
                    onValueChange={(value) => {
                      if (!value) return;
                      onIsoStandardChange(value);
                      if (value !== "OTHER") onCustomIsoStandardChange("");
                    }}
                  >
                    <SelectTrigger id="course-iso-standard" className="w-full" aria-required="true">
                      <SelectValue placeholder="Select an ISO standard" />
                    </SelectTrigger>
                    <SelectContent>
                      {ISO_STANDARD_OPTIONS.map((standard) => (
                        <SelectItem key={standard} value={standard}>
                          {standard}
                        </SelectItem>
                      ))}
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  {isoStandard === "OTHER" && (
                    <Input
                      value={customIsoStandard}
                      onChange={(event) =>
                        onCustomIsoStandardChange(event.target.value)
                      }
                      placeholder="Enter ISO standard"
                      required
                      aria-required="true"
                      maxLength={200}
                    />
                  )}
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="course-description">Description <span className="text-destructive" aria-hidden="true">*</span></Label>
                    <span
                      className={
                        descriptionTooLong
                          ? "text-xs font-medium text-destructive"
                          : "text-xs text-muted-foreground"
                      }
                    >
                      {description.length}/{MAX_COURSE_DESCRIPTION_LENGTH}
                    </span>
                  </div>
                  <Textarea
                    id="course-description"
                    value={description}
                    onChange={(e) => onDescriptionChange(e.target.value)}
                    required
                    aria-required="true"
                    placeholder="What will students learn?"
                    className="min-h-28"
                    aria-invalid={descriptionTooLong}
                    aria-describedby={
                      descriptionTooLong
                        ? "course-description-error"
                        : undefined
                    }
                  />
                  {descriptionTooLong && (
                    <p
                      id="course-description-error"
                      className="text-xs font-medium text-destructive"
                      role="alert"
                    >
                      Description cannot exceed {MAX_COURSE_DESCRIPTION_LENGTH}{" "}
                      characters
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>  );
}
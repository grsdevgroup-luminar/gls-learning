"use client";

import { CourseArt, isImageThumbnail } from "@/components/shared/course-art";
import { CourseBuilderHeader } from "./course-builder-header";
import { CourseDetailsForm } from "./course-details-form";
import { CurriculumEditor } from "./curriculum-editor";
import { useCourseBuilder } from "./use-course-builder";
import { CourseStatusBadge } from "@/components/shared/course-status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LEVEL_TO_API, lessonTypes } from "./course-builder.types";
import { thumbSeeds } from "./course-builder.utils";
import {
  Trash2,
  ImagePlus,
  Lock,
} from "lucide-react";
import {
  FormSkeleton,
  PageHeaderSkeleton,
} from "@/components/shared/loading-skeletons";

export function CourseBuilder({
  courseId,
  mode = "admin",
  revisionMode = false,
  revisionApprovalRequestId,
  onApproveRevision,
  approvingRevision = false,
}: {
  courseId?: string;
  mode?: "admin" | "instructor";
  revisionMode?: boolean;
  revisionApprovalRequestId?: string;
  onApproveRevision?: () => void;
  approvingRevision?: boolean;
}) {
  const {
    detail, isLoading, title, setTitle, subtitle, setSubtitle, setCategory,
    isoStandard, setIsoStandard, customIsoStandard, setCustomIsoStandard, level, setLevel,
    description, setDescription, price, setPrice, thumbnail, setThumbnail, thumbDrag, setThumbDrag,
    thumbError, thumbInputRef, categoryValue, titleTooLong, subtitleTooLong,
    descriptionTooLong, published, setPublished, visibility, setVisibility, saving, savingAction,
    dragSection, setDragSection, collapsedSections, sections, totalLessons, moveSection,
    addSection, patchSection, removeSection, addLesson, patchLesson, setLessonType, removeLesson,
    handleThumbnailFile, save, onBack,
  } = useCourseBuilder({ courseId, mode, revisionMode });
  if (courseId && isLoading) {
    return (
      <div className="space-y-6 p-6 md:p-8">
        <PageHeaderSkeleton action />
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="rounded-xl border p-6">
            <FormSkeleton fields={5} />
          </div>
          <div className="space-y-6">
            <div className="h-44 animate-pulse rounded-xl bg-muted" />
            <div className="h-52 animate-pulse rounded-xl bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full min-w-0 flex-col overflow-x-clip lg:absolute lg:inset-0 lg:h-full lg:max-h-full lg:min-h-0 lg:overflow-hidden">
      <CourseBuilderHeader
        courseId={courseId}
        mode={mode}
        totalLessons={totalLessons}
        sectionCount={sections.length}
        saving={saving}
        savingAction={savingAction}
        published={published}
        onBack={onBack}
        onSave={save}
        approvalMode={!!revisionApprovalRequestId}
        onApprove={onApproveRevision}
        approving={approvingRevision}
      />

      {/* CONTENT WRAPPER: Takes up remaining height */}
      <div className="min-h-0 w-full min-w-0 flex-1 p-6 md:p-8 lg:overflow-hidden lg:pb-0">
        {/* GRID: Extends to full height on desktop */}
        <div className="grid min-h-0 w-full min-w-0 gap-6 lg:h-full lg:grid-cols-[1fr_320px]">
          {/* LEFT COLUMN: Independently scrollable */}
          <div className="min-h-0 min-w-0 space-y-6 lg:h-full lg:overflow-y-auto lg:pr-4">
            <CourseDetailsForm
              title={title}
              subtitle={subtitle}
              categoryValue={categoryValue}
              level={level}
              levelOptions={Object.keys(LEVEL_TO_API)}
              isoStandard={isoStandard}
              customIsoStandard={customIsoStandard}
              description={description}
              titleTooLong={titleTooLong}
              subtitleTooLong={subtitleTooLong}
              descriptionTooLong={descriptionTooLong}
              canManage={mode === "admin"}
              onTitleChange={setTitle}
              onSubtitleChange={setSubtitle}
              onCategoryChange={setCategory}
              onLevelChange={(value) => setLevel(value as keyof typeof LEVEL_TO_API)}
              onIsoStandardChange={(value) => {
                setIsoStandard(value);
                if (value !== "OTHER") setCustomIsoStandard("");
              }}
              onCustomIsoStandardChange={setCustomIsoStandard}
              onDescriptionChange={setDescription}
            />
            <CurriculumEditor
              courseId={courseId}
              sections={sections}
              dragSection={dragSection}
              collapsedSections={collapsedSections}
              lessonTypes={lessonTypes}
addSection={addSection}
              moveSection={moveSection}
              setDragSection={setDragSection}
              patchSection={patchSection}
              removeSection={removeSection}
              addLesson={addLesson}
              patchLesson={patchLesson}
              setLessonType={setLessonType}
              removeLesson={removeLesson}
            />
          </div>

          {/* RIGHT COLUMN: Independently scrollable */}
          <div className="min-h-0 min-w-0 space-y-6 lg:h-full lg:overflow-y-auto lg:pr-4">
            {mode === "instructor" ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Review status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Current</div>
                    <CourseStatusBadge status={detail?.status ?? "DRAFT"} />
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Save a draft any time. When you&apos;re ready,{" "}
                    <span className="font-medium text-foreground">
                      Submit for review
                    </span>{" "}
                    — our team approves new courses before they go live to keep
                    quality high.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Publish</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">Status</div>
                      <div className="text-xs text-muted-foreground">
                        {published ? "Visible to students" : "Hidden — draft"}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        published ? "text-success" : "text-muted-foreground"
                      }
                    >
                      {published ? "Published" : "Draft"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="pub">Publish course</Label>
                    <Switch
                      id="pub"
                      checked={published}
                      onCheckedChange={setPublished}
                    />
                  </div>
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                        <Label htmlFor="priv">Private course</Label>
                      </div>
                      <Switch
                        id="priv"
                        checked={visibility === "PRIVATE"}
                        onCheckedChange={(checked) =>
                          setVisibility(checked ? "PRIVATE" : "PUBLIC")
                        }
                        disabled={!published}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {published
                        ? "Hides this course from the public catalog. Assign it to specific organizations from the Organizations page to control who can access it."
                        : "Publish the course first to make it private."}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pricing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Label>Base price (USD) <span className="text-destructive" aria-hidden="true">*</span></Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                    aria-required="true"
                    placeholder="Enter base price"
                    className="pl-7"
                    inputMode="decimal"
                    min="0.01"
                    step="0.01"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Regional & per-country pricing is applied automatically from
                  your Pricing rules.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Course thumbnail <span className="text-destructive" aria-hidden="true">*</span></CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <CourseArt
                  seed={thumbnail}
                  title={title || "Course title"}
                  category={categoryValue}
                  className="h-32 rounded-lg"
                />

                <input
                  ref={thumbInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    handleThumbnailFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => thumbInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setThumbDrag(true);
                  }}
                  onDragLeave={() => setThumbDrag(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setThumbDrag(false);
                    handleThumbnailFile(e.dataTransfer.files?.[0]);
                  }}
                  className={cn(
                    "flex w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-4 text-center transition-colors",
                    thumbDrag
                      ? "border-primary bg-primary/5"
                      : "hover:border-primary/50 hover:bg-muted/40",
                  )}
                >
                  <ImagePlus className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium">
                    Drag & drop an image, or click to upload
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    PNG or JPG · recommended 1280×720
                  </span>
                </button>
                {thumbError && (
                  <p className="text-xs text-destructive">{thumbError}</p>
                )}
                {isImageThumbnail(thumbnail) && (
                  <ConfirmDialog
                    trigger={
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-muted-foreground"
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove image
                      </Button>
                    }
                    title="Remove this course image?"
                    description="You can pick a new image or color theme afterward."
                    confirmLabel="Remove"
                    onConfirm={() => setThumbnail(thumbSeeds[0])}
                  />
                )}

                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">
                    Or pick a color theme
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {thumbSeeds.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setThumbnail(t)}
                        className={`h-7 w-7 rounded-md border-2 ${thumbnail === t ? "border-primary" : "border-transparent"}`}
                      >
                        <CourseArt
                          seed={t}
                          title=""
                          className="h-full w-full rounded"
                          iconSize={12}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

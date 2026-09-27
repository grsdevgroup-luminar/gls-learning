"use client";

import { QuizEditor, emptyQuiz } from "@/components/shared/quiz-editor";
import { VideoUpload } from "@/components/shared/video-upload";
import { LessonResources } from "./lesson-resources";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import type { BLesson, BuilderLessonType } from "./course-builder.types";
import { articleDurationSec, isTemp, quizDurationSec } from "./course-builder.utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, FileText, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

type LessonTypeOption = { value: BuilderLessonType; label: string };

export function LessonEditor({ courseId, sectionId, lesson, lessonTypes, patchLesson, setLessonType, removeLesson }: { courseId?: string; sectionId: string; lesson: BLesson; lessonTypes: LessonTypeOption[]; patchLesson: (sectionId: string, lessonId: string, patch: Partial<BLesson>) => void; setLessonType: (sectionId: string, lessonId: string, type: BuilderLessonType) => void; removeLesson: (sectionId: string, lessonId: string) => void; }) {
  return (                          <div
                            key={lesson.id}
                            className="rounded-lg border bg-card p-3"
                          >
                            <div className="flex items-center gap-2">
                              <Input
                                value={lesson.title}
                                onChange={(e) =>
                                  patchLesson(sectionId, lesson.id, {
                                    title: e.target.value,
                                  })
                                }
                                className="h-8 min-w-0 flex-1"
                                placeholder="Lesson title"
                              />
                              <Select
                                value={lesson.type}
                                onValueChange={(v) =>
                                  v &&
                                  setLessonType(
                                    sectionId,
                                    lesson.id,
                                    v as BuilderLessonType,
                                  )
                                }
                              >
                                <SelectTrigger className="h-8 w-28 shrink-0">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {lessonTypes.map((t) => (
                                    <SelectItem key={t.value} value={t.value}>
                                      {t.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                                <Eye className="h-3.5 w-3.5" /> Preview
                                <Switch
                                  size="sm"
                                  checked={lesson.preview}
                                  onCheckedChange={() =>
                                    patchLesson(sectionId, lesson.id, {
                                      preview: !lesson.preview,
                                    })
                                  }
                                />
                              </label>
                              <ConfirmDialog
                                trigger={
                                  <Button
                                    size="icon-sm"
                                    variant="ghost"
                                    aria-label="Remove lesson"
                                  >
                                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                                  </Button>
                                }
                                title="Remove this lesson?"
                                description="This can't be undone."
                                confirmLabel="Remove"
                                onConfirm={() => removeLesson(sectionId, lesson.id)}
                              />
                            </div>
                            <div className="mt-2">
                              {lesson.type === "quiz" ? (
                                <QuizEditor
                                  quiz={lesson.quiz ?? emptyQuiz()}
                                  onChange={(quiz) =>
                                    patchLesson(sectionId, lesson.id, {
                                      quiz,
                                      quizDirty: true,
                                      durationSec: quizDurationSec(quiz),
                                    })
                                  }
                                />
                              ) : lesson.type === "video" ? (
                                <VideoUpload
                                  compact
                                  courseId={courseId}
                                  lessonId={lesson.id}
                                  initiallyUploaded={
                                    lesson.hasVideo && !lesson.replacingVideo
                                  }
                                  initialUploadId={lesson.uploadId}
                                  replacingVideo={lesson.replacingVideo}
                                  committedVideo={
                                    lesson.cfVideoUid
                                      ? {
                                          uid: lesson.cfVideoUid,
                                          uploadId: lesson.uploadId,
                                          label: lesson.videoLabel ?? undefined,
                                        }
                                      : null
                                  }
                                  onReplaceRequested={() =>
                                    patchLesson(sectionId, lesson.id, {
                                      replacingVideo: true,
                                    })
                                  }
                                  onReplaceCancelled={() =>
                                    patchLesson(sectionId, lesson.id, {
                                      replacingVideo: false,
                                    })
                                  }
                                  onUploaded={({
                                    uploadId,
                                    uid,
                                    filename,
                                    durationSec,
                                  }) =>
                                    patchLesson(sectionId, lesson.id, {
                                      cfVideoUid: uid,
                                      uploadId,
                                      hasVideo: true,
                                      replacingVideo: false,
                                      videoLabel: filename,
                                      ...(durationSec ? { durationSec } : {}),
                                    })
                                  }
                                />
                              ) : (
                                <Textarea
                                  value={lesson.articleContent}
                                  onChange={(e) =>
                                    patchLesson(sectionId, lesson.id, {
                                      articleContent: e.target.value,
                                      durationSec: articleDurationSec(
                                        e.target.value,
                                      ),
                                    })
                                  }
                                  placeholder="Write the article content students will read for this lesson…"
                                  className="min-h-32 text-sm"
                                />
                              )}
                            </div>
                            {lesson.type === "video" && (
                              <div className="mt-4 rounded-lg border border-dashed p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div>
                                    <Label className="text-sm">
                                      Featured PowerPoint slides (Optional)
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                      Attach one .pptx to show in Slides mode.
                                      Add other files under Downloadable resources.
                                    </p>
                                  </div>
                                  <label
                                    htmlFor={`pptx-upload-${lesson.id}`}
                                    className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                                  >
                                    <Upload className="h-4 w-4" />
                                    Choose PowerPoint
                                  </label>
                                  <input
                                    id={`pptx-upload-${lesson.id}`}
                                    className="hidden"
                                    type="file"
                                    accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) {
                                        e.currentTarget.value = "";
                                        return;
                                      }
                                      if (
                                        !file.name
                                          .toLowerCase()
                                          .endsWith(".pptx") ||
                                        file.type !==
                                          "application/vnd.openxmlformats-officedocument.presentationml.presentation"
                                      ) {
                                        toast.error(
                                          "Only .pptx PowerPoint files are supported.",
                                        );
                                        e.currentTarget.value = "";
                                        return;
                                      }
                                      patchLesson(sectionId, lesson.id, {
                                        pendingPptxFile: file,
                                        pptxName: file.name,
                                        removePptx: false,
                                      });
                                    }}
                                  />
                                </div>
                                {lesson.pptxName && (
                                  <div className="mt-2 flex items-center gap-2 text-xs">
                                    <FileText className="h-4 w-4 text-primary" />
                                    <span className="flex-1 truncate">
                                      Current: {lesson.pptxName}
                                    </span>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={() =>
                                        patchLesson(sectionId, lesson.id, {
                                          pendingPptxFile: null,
                                          pptxName: null,
                                          removePptx: true,
                                        })
                                      }
                                    >
                                      Remove
                                    </Button>
                                  </div>
                                )}
                                {(lesson.pendingPptxFile || lesson.pptxName) && (
                                  <div className="mt-2 flex items-center gap-2">
                                    <Label
                                      htmlFor={`pptx-duration-${lesson.id}`}
                                      className="text-xs"
                                    >
                                      Learning time (minutes)
                                    </Label>
                                    <Input
                                      id={`pptx-duration-${lesson.id}`}
                                      type="number"
                                      min="0"
                                      max="1440"
                                      value={Math.round(lesson.pptxDurationSec / 60)}
                                      onChange={(e) =>
                                        patchLesson(sectionId, lesson.id, {
                                          pptxDurationSec:
                                            Math.max(
                                              0,
                                              Number(e.target.value) || 0,
                                            ) * 60,
                                        })
                                      }
                                      className="h-8 w-24"
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                            <LessonResources
                              lessonId={lesson.id}
                              isNew={isTemp(lesson.id)}
                              resources={lesson.resources}
                              onChange={(resources) =>
                                patchLesson(sectionId, lesson.id, { resources })
                              }
                              pendingFiles={lesson.pendingResourceFiles}
                              onPendingUpload={(file) =>
                                patchLesson(sectionId, lesson.id, {
                                  pendingResourceFiles: [
                                    ...lesson.pendingResourceFiles,
                                    file,
                                  ],
                                })
                              }
                              onRemovePendingUpload={(index) =>
                                patchLesson(sectionId, lesson.id, {
                                  pendingResourceFiles:
                                    lesson.pendingResourceFiles.filter(
                                      (_, i) => i !== index,
                                    ),
                                })
                              }
                            />
                          </div>
  );
}
"use client";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { LessonEditor } from "./lesson-editor";
import type { BSection, BuilderLessonType } from "./course-builder.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type LessonTypeOption = { value: BuilderLessonType; label: string };

export function SectionEditor({ section, index, dragSection, collapsed, lessonTypes, onDragStart, onDragEnd, onDrop, onPatch, onRemove, onAddLesson, patchLesson, setLessonType, removeLesson, courseId }: {
  section: BSection;
  index: number;
  dragSection: number | null;
  collapsed: boolean;
  lessonTypes: LessonTypeOption[];
  onDragStart: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
  onPatch: (id: string, patch: Partial<BSection>) => void;
  onRemove: (id: string) => void;
  onAddLesson: (id: string) => void;
  patchLesson: (sectionId: string, lessonId: string, patch: Partial<import("./course-builder.types").BLesson>) => void;
  setLessonType: (sectionId: string, lessonId: string, type: BuilderLessonType) => void;
  removeLesson: (sectionId: string, lessonId: string) => void;
  courseId?: string;
}) {
  return (                  <div
                    key={section.id}
                    className={cn(
                      "rounded-xl border bg-muted/20 p-3",
                      dragSection === index && "opacity-50",
                    )}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={onDrop}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        draggable
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                        role="button"
                        tabIndex={0}
                        aria-label="Drag to reorder section"
                        className="shrink-0 cursor-grab"
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                      </span>
                      <Input
                        value={section.title}
                        onChange={(e) =>
                          onPatch(section.id, { title: e.target.value })
                        }
                        className="h-8 min-w-0 flex-1 font-medium"
                      />
                      <ConfirmDialog
                        trigger={
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label="Remove section"
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        }
                        title="Remove this section?"
                        description="All of its lessons will be removed too."
                        confirmLabel="Remove"
                        onConfirm={() => onRemove(section.id)}
                      />
                    </div>

                    {!collapsed && (
                      <div className="mt-3 space-y-3 pl-6">
                        {section.lessons.map((l) => (
                        <LessonEditor key={l.id} courseId={courseId} sectionId={section.id} lesson={l} lessonTypes={lessonTypes} patchLesson={patchLesson} setLessonType={setLessonType} removeLesson={removeLesson} />
                        ))}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground"
                          onClick={() => onAddLesson(section.id)}
                        >
                          <Plus /> Add lesson
                        </Button>
                      </div>
                    )}
                  </div>
  );
}
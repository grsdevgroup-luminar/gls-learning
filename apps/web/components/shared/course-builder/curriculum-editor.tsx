"use client";

import type { BLesson, BSection, BuilderLessonType } from "./course-builder.types";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionEditor } from "./section-editor";

type LessonTypeOption = { value: BuilderLessonType; label: string };

export function CurriculumEditor({ courseId, sections, dragSection, collapsedSections, lessonTypes, addSection, moveSection, setDragSection, patchSection, removeSection, addLesson, patchLesson, setLessonType, removeLesson }: {
  courseId?: string; sections: BSection[]; dragSection: number | null; collapsedSections: Set<string>; lessonTypes: LessonTypeOption[]; addSection: () => void; moveSection: (to: number) => void; setDragSection: (value: number | null) => void; patchSection: (id: string, patch: Partial<BSection>) => void; removeSection: (id: string) => void; addLesson: (sectionId: string) => void; patchLesson: (sectionId: string, lessonId: string, patch: Partial<BLesson>) => void; setLessonType: (sectionId: string, lessonId: string, type: BuilderLessonType) => void; removeLesson: (sectionId: string, lessonId: string) => void;
}) {
  return (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base">Curriculum</CardTitle>
                <Button size="sm" variant="outline" onClick={addSection}>
                  <Plus className="mr-2 h-4 w-4" /> Add section
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {sections?.map((s, si) => (
                  <SectionEditor
                    key={s.id}
                    section={s}
                    index={si}
                    dragSection={dragSection}
                    collapsed={collapsedSections.has(s.id)}
                    lessonTypes={lessonTypes}
                    onDragStart={() => setDragSection(si)}
                    onDragEnd={() => setDragSection(null)}
                    onDrop={() => moveSection(si)}
                    onPatch={patchSection}
                    onRemove={removeSection}
                    onAddLesson={addLesson}
                    patchLesson={patchLesson}
                    setLessonType={setLessonType}
                    removeLesson={removeLesson}
                    courseId={courseId}
                  />
                ))}                {sections.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No sections yet. Add your first section to get started.
                  </p>
                )}
              </CardContent>
            </Card>
  );
}
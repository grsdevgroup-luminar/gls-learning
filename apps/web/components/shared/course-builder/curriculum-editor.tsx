"use client";

import type { BLesson, BSection, BuilderLessonType } from "./course-builder.types";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionEditor } from "./section-editor";

type LessonTypeOption = { value: BuilderLessonType; label: string };

export function CurriculumEditor({ courseId, sections, dragSection, collapsedSections, lessonTypes, addSection, moveSection, setDragSection, patchSection, removeSection, addLesson, patchLesson, setLessonType, removeLesson }: {
  courseId?: string; sections: BSection[]; dragSection: number | null; collapsedSections: Set<string>; lessonTypes: LessonTypeOption[]; addSection: (insertAt?: number) => void; moveSection: (to: number) => void; setDragSection: (value: number | null) => void; patchSection: (id: string, patch: Partial<BSection>) => void; removeSection: (id: string) => void; addLesson: (sectionId: string) => void; patchLesson: (sectionId: string, lessonId: string, patch: Partial<BLesson>) => void; setLessonType: (sectionId: string, lessonId: string, type: BuilderLessonType) => void; removeLesson: (sectionId: string, lessonId: string) => void;
}) {
  return (
    <Card className="min-w-0 max-w-full">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Curriculum</CardTitle>
        <Button type="button" variant="outline" size="sm" onClick={() => addSection()}>
          <Plus className="mr-2 h-4 w-4" /> Add section
        </Button>
      </CardHeader>
      <CardContent className="min-w-0 max-w-full space-y-4">
        {sections?.map((s, si) => (
          <div key={s.id} className="space-y-4">
            <SectionEditor
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
            {si < sections.length - 1 && (
              <button
                type="button"
                onClick={() => addSection(si + 1)}
                className="group flex w-full items-center gap-3 py-1 text-xs text-muted-foreground"
                aria-label={`Insert section between section ${si + 1} and section ${si + 2}`}
              >
                <span className="h-px flex-1 bg-border transition-colors group-hover:bg-primary" />
                <span className="inline-flex items-center gap-1 rounded-full border bg-background px-3 py-1 transition-colors group-hover:border-primary group-hover:text-primary">
                  <Plus className="h-3.5 w-3.5" /> Insert section here
                </span>
                <span className="h-px flex-1 bg-border transition-colors group-hover:bg-primary" />
              </button>
            )}
          </div>
        ))}
        {sections.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No sections yet. Add your first section to get started.
          </p>
        )}
        {sections.length === 0 && (
          <Button type="button" variant="outline" className="w-full" onClick={() => addSection()}>
            <Plus className="mr-2 h-4 w-4" /> Add section
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

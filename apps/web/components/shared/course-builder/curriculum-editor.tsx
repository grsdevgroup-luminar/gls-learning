"use client";

import type { BLesson, BSection, BuilderLessonType } from "./course-builder.types";
import { Button } from "@/components/ui/button";
import { AlertCircle, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionEditor } from "./section-editor";

type LessonTypeOption = { value: BuilderLessonType; label: string };

export function CurriculumEditor({ courseId, sections, dragSection, collapsedSections, submissionIssues, onRevealLesson, lessonTypes, addSection, moveSection, setDragSection, patchSection, removeSection, addLesson, patchLesson, setLessonType, removeLesson }: {
  courseId?: string; sections: BSection[]; dragSection: number | null; collapsedSections: Set<string>; submissionIssues: { sectionId: string; lessonId: string; sectionTitle: string; lessonTitle: string; reason: string }[]; onRevealLesson: (sectionId: string, lessonId: string) => void; lessonTypes: LessonTypeOption[]; addSection: (insertAt?: number) => void; moveSection: (to: number) => void; setDragSection: (value: number | null) => void; patchSection: (id: string, patch: Partial<BSection>) => void; removeSection: (id: string) => void; addLesson: (sectionId: string) => void; patchLesson: (sectionId: string, lessonId: string, patch: Partial<BLesson>) => void; setLessonType: (sectionId: string, lessonId: string, type: BuilderLessonType) => void; removeLesson: (sectionId: string, lessonId: string) => void;
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
        {submissionIssues.length > 0 && (
          <div id="course-submission-issues" role="alert" className="scroll-mt-24 space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-destructive"><AlertCircle className="h-4 w-4 shrink-0" />Complete these lessons before submitting</p>
            <ul className="space-y-2">
              {submissionIssues.map((issue) => (
                <li key={issue.lessonId}>
                  <button type="button" className="w-full rounded-md border bg-background p-2 text-left text-sm hover:border-destructive/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" onClick={() => onRevealLesson(issue.sectionId, issue.lessonId)}>
                    <span className="block font-medium">{issue.sectionTitle || "Untitled section"} → {issue.lessonTitle}</span>
                    <span className="block text-xs text-muted-foreground">{issue.reason} Select to jump to this lesson.</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
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
              issues={submissionIssues.filter((issue) => issue.sectionId === s.id)}
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

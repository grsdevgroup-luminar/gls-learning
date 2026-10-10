"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, Loader2, Rocket, Save } from "lucide-react";

type SaveAction = "draft" | "publish" | "review";

export function CourseBuilderHeader({ courseId, mode, totalLessons, sectionCount, saving, savingAction, published, onBack, onSave, approvalMode = false, onApprove, approving = false }: {
  courseId?: string;
  mode: "admin" | "instructor";
  totalLessons: number;
  sectionCount: number;
  saving: boolean;
  savingAction: SaveAction | null;
  published: boolean;
  onBack: () => void;
  onSave: (action: SaveAction) => void;
  approvalMode?: boolean;
  onApprove?: () => void;
  approving?: boolean;
}) {
  return (
    <div className="sticky top-0 z-50 flex min-w-0 shrink-0 flex-col gap-3 border-b bg-background px-4 py-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-4 md:px-8 lg:static">
      <div className="flex min-w-0 items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back"><ArrowLeft className="h-5 w-5" /></Button>
        <div>
          <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{courseId ? "Edit course" : "Create a course"}</h1>
          <p className="text-sm text-muted-foreground">{totalLessons} lessons · {sectionCount} sections</p>
        </div>
      </div>
      <div className="flex min-w-0 w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        {mode === "instructor" ? (
          <>
            <Button type="button" variant="outline" onClick={() => onSave("draft")} disabled={saving}>
              {savingAction === "draft" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save draft
            </Button>
            <Button type="button" onClick={() => onSave("review")} disabled={saving}>
              {savingAction === "review" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />} Submit for review
            </Button>
          </>
        ) : approvalMode ? (
          <Button onClick={onApprove} disabled={saving || approving || !onApprove}>
            {approving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />} Approve changes
          </Button>
        ) : (
          <Button onClick={() => onSave(published ? "publish" : "draft")} disabled={saving}>
            {savingAction === (published ? "publish" : "draft") ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save
          </Button>
        )}
      </div>
    </div>
  );
}

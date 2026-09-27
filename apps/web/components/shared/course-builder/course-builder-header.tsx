"use client";

import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Loader2,
  Rocket,
  Save,
} from "lucide-react";

type SaveAction = "draft" | "publish" | "review";

export function CourseBuilderHeader({
  courseId,
  mode,
  totalLessons,
  sectionCount,
  saving,
  savingAction,
  published,
  onBack,
  onSave,
}: {
  courseId?: string;
  mode: "admin" | "instructor";
  totalLessons: number;
  sectionCount: number;
  saving: boolean;
  savingAction: SaveAction | null;
  published: boolean;
  onBack: () => void;
  onSave: (action: SaveAction) => void;
}) {
  return (
<div className="shrink-0 sticky top-0 z-50 flex flex-wrap items-center justify-between gap-4 border-b bg-background px-6 py-4 shadow-sm md:px-8 lg:static">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onBack()}
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {courseId ? "Edit course" : "Create a course"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {totalLessons} lessons · {sectionCount} sections
            </p>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          {mode === "instructor" ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => onSave("draft")}
                disabled={saving}
              >
                {savingAction === "draft" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}{" "}
                Save draft
              </Button>
              <Button
                type="button"
                onClick={() => onSave("review")}
                disabled={saving}
              >
                {savingAction === "review" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Rocket className="mr-2 h-4 w-4" />
                )}
                Submit for review
              </Button>
            </>
          ) : (
            <Button
              onClick={() => onSave(published ? "publish" : "draft")}
              disabled={saving}
            >
              {savingAction === (published ? "publish" : "draft") ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save
            </Button>
          )}
        </div>
      </div>
  );
}
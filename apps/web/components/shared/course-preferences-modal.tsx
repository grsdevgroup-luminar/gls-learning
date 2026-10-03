"use client";

import { useEffect, useState, useRef } from "react";
import {
  BrainCircuit,
  BookOpen,
  Cloud,
  Code2,
  HeartPulse,
  Landmark,
  Languages,
  LoaderCircle,
  Megaphone,
  MessageCircleMore,
  Palette,
} from "lucide-react";
import { toast } from "sonner";
import { type LearningCategory } from "@skillstream/shared";
import { ApiError } from "@/lib/api/errors";
import { useCategories, useSaveCoursePreferences } from "@/lib/api/hooks";
import { useSession } from "@/lib/api/session";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const categoryIcons: Partial<Record<string, typeof Cloud>> = {
  Cloud,
  Communication: MessageCircleMore,
  "Data Science": BrainCircuit,
  Design: Palette,
  Development: Code2,
  Finance: Landmark,
  "Health & Wellness": HeartPulse,
  "Language Learning": Languages,
  Marketing: Megaphone,
  "Personal Development": BookOpen,
};

const EMPTY_CATEGORIES: readonly LearningCategory[] = [];

interface CoursePreferencesModalProps {
  open: boolean;
  initialCategories?: readonly LearningCategory[];
  onOpenChange?: (open: boolean) => void;
  onSaved: () => void;
  studentOnly?: boolean;
}

/** Shared by sign-up and dashboard so learners edit the exact same preferences. */
export function CoursePreferencesModal({
  open,
  initialCategories = EMPTY_CATEGORIES,
  onOpenChange,
  onSaved,
  studentOnly = false,
}: CoursePreferencesModalProps) {
  const { role, isLoading: sessionLoading } = useSession();
  const savePreferences = useSaveCoursePreferences();
  const wasOpen = useRef(false);
  const { data: categories = [], isLoading: categoriesLoading } =
    useCategories();

  const [selectedCategories, setSelectedCategories] = useState<
    LearningCategory[]
  >([...initialCategories]);

  useEffect(() => {
    const justOpened = open && !wasOpen.current;

    if (justOpened) {
      // Initialize a new draft only when the dialog opens. Background query
      // refetches can replace initialCategories while the draft is being edited.
      setSelectedCategories([...initialCategories]);
    }

    wasOpen.current = open;
  }, [open, initialCategories]);

  if (studentOnly && (sessionLoading || role !== "STUDENT")) {
    return null;
  }

  function toggleCategory(category: LearningCategory) {
    setSelectedCategories((current) => {
      if (current.includes(category)) {
        return current.filter((item) => item !== category);
      }

      return [...current, category];
    });
  }

  async function save() {
    if (selectedCategories.length < 3) {
      return;
    }

    try {
      await savePreferences.mutateAsync({
        categories: selectedCategories,
        keywords: [],
      });

      toast.success("Learning preferences saved", {
        description: "Your course recommendations have been updated.",
      });

      onSaved();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.displayMessage
          : "Could not save your choices";

      toast.error("Please try again", {
        description: message,
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={Boolean(onOpenChange)}
        className="
        w-[min(92vw,720px)]
        max-w-none!
        max-h-[90dvh]
        flex
        flex-col
        min-w-0
        gap-0
        overflow-x-hidden
        overflow-hidden
        p-0
        shadow-2xl
       "
      >
        {/* Header + Categories */}
        <div className="min-h-0 min-w-0 overflow-hidden px-3 pb-5 pt-6 sm:px-6 sm:pb-7 sm:pt-8">
          <DialogHeader className="w-full items-center gap-2 text-center">
            <DialogTitle className="w-full text-center text-2xl font-semibold tracking-tight sm:text-3xl">
              Choose your learning interests
            </DialogTitle>

            <DialogDescription className="w-full max-w-xl text-center text-sm sm:text-base">
              Choose at least three categories to personalize your course
              recommendations.
            </DialogDescription>
          </DialogHeader>

          {/* The viewport stays two rows by five columns; new categories scroll inside it. */}
          <div
            className="mt-5 min-w-0 aspect-[5/2] max-h-[40vw] overflow-y-auto overscroll-contain pr-1 sm:mt-5 sm:pr-2"
            aria-label="Learning interest categories"
          >
            <div
              aria-busy={savePreferences.isPending}
              className="grid h-full min-w-0 grid-cols-5 auto-rows-[calc((100%_-_0.375rem)/2)] gap-1.5 sm:auto-rows-[calc((100%_-_0.75rem)/2)] sm:gap-3"
            >
              {categories.map((category) => {
                const selected = selectedCategories.includes(category);
                const CategoryIcon = categoryIcons[category] ?? BookOpen;

                return (
                  <button
                    key={category}
                    type="button"
                    aria-pressed={selected}
                    disabled={savePreferences.isPending || categoriesLoading}
                    onClick={() => toggleCategory(category)}
                    className={`flex h-full min-w-0 w-full flex-col items-center justify-center gap-0.5 overflow-hidden rounded-lg border px-0.5 py-1 text-center text-[9px] font-medium leading-tight whitespace-normal wrap-break-words transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 sm:gap-1 sm:px-2 sm:py-2 sm:text-sm ${
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:border-primary hover:bg-accent"
                    }`}
                  >
                    <span className="flex size-5 shrink-0 items-center justify-center sm:size-6">
                      <CategoryIcon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="line-clamp-2 min-h-[2.25em] w-full min-w-0 max-w-full text-center wrap-break-words">
                      {category}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="
            flex
            min-w-0
            shrink-0
            items-center
            justify-between
            gap-3
            border-t
            border-border
            bg-muted/20
            px-3
            py-3
            sm:px-6
            sm:py-4
          "
        >
          <span
            className={
              selectedCategories.length >= 3
                ? "shrink-0 text-sm font-medium text-primary sm:text-base"
                : "shrink-0 text-sm text-muted-foreground sm:text-base"
            }
          >
            {studentOnly
              ? `${selectedCategories.length} selected${selectedCategories.length < 3 ? ` · choose ${3 - selectedCategories.length} more` : ""}`
              : `${selectedCategories.length} selected`}
          </span>

          <Button
            type="button"
            className="
              h-10
              min-w-0
              shrink
              px-3
              text-sm
              sm:h-11
              sm:min-w-48
              sm:px-4
              sm:text-base
            "
            disabled={
              selectedCategories.length < 3 || savePreferences.isPending
            }
            onClick={() => void save()}
          >
            {savePreferences.isPending ? (
              <>
                <LoaderCircle className="animate-spin" />
                Saving...
              </>
            ) : studentOnly ? (
              "Save preferences"
            ) : (
              "Show recommendations"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

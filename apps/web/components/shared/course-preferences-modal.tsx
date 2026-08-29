"use client";

import { useState } from "react";
import {
  BrainCircuit,
  Cloud,
  Code2,
  HeartPulse,
  Landmark,
  Languages,
  LoaderCircle,
  Megaphone,
  MessageCircleMore,
  Palette,
  Sprout,
} from "lucide-react";
import { toast } from "sonner";
import {
  type LearningCategory,
} from "@skillstream/shared";
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
  "Personal Development": Sprout,
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
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();

  const [selectedCategories, setSelectedCategories] =
    useState<LearningCategory[]>([...initialCategories]);

  if (studentOnly && (sessionLoading || role !== "STUDENT")) {
    return null;
  }

  function toggleCategory(category: LearningCategory) {
    setSelectedCategories((current) => {
      if (current.includes(category)) {
        return current.filter((item) => item !== category);
      }

      if (current.length === 3) {
        return current;
      }

      return [...current, category];
    });
  }

  async function save() {
    if (selectedCategories.length !== 3) {
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
        min-w-0
        gap-0
        overflow-x-hidden
        overflow-y-auto
        p-0
        shadow-2xl
       "
      >
        {/* Header + Categories */}
        <div className="min-w-0 px-3 pb-5 pt-6 sm:px-6 sm:pb-7 sm:pt-8">
          <DialogHeader className="items-center gap-2 text-center">
            <DialogTitle className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Choose your learning interests
            </DialogTitle>

            <DialogDescription className="max-w-xl text-sm sm:text-base">
              Choose exactly three categories to personalize your course
              recommendations.
            </DialogDescription>
          </DialogHeader>

          {/* The viewport stays two rows by five columns; new categories scroll inside it. */}
          <div className="mt-5 min-w-0 aspect-[5/2] overflow-y-auto pr-1 sm:mt-5 sm:pr-2">
            <div
              aria-busy={savePreferences.isPending}
              className="grid min-w-0 grid-cols-5 gap-1.5 sm:gap-3"
            >
              {categories.map((category) => {
                const selected = selectedCategories.includes(category);
                const unavailable =
                  selectedCategories.length === 3 && !selected;

                const CategoryIcon = categoryIcons[category] ?? Sprout;

                return (
                  <button
                    key={category}
                    type="button"
                    aria-pressed={selected}
                    disabled={unavailable || savePreferences.isPending || categoriesLoading}
                    onClick={() => toggleCategory(category)}
                    className={`flex aspect-square min-w-0 w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border px-2 py-2 text-center text-[10px] font-medium leading-tight whitespace-normal wrap-break-words transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm ${selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:border-primary hover:bg-accent"
                      }`}
                  >
                    <CategoryIcon
                      className="size-8 shrink-0 sm:size-6"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 max-w-full wrap-break-words">
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
              selectedCategories.length === 3
                ? "shrink-0 text-sm font-medium text-primary sm:text-base"
                : "shrink-0 text-sm text-muted-foreground sm:text-base"
            }
          >
            {selectedCategories.length}/3 selected
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
              selectedCategories.length !== 3 ||
              savePreferences.isPending
            }
            onClick={() => void save()}
          >
            {savePreferences.isPending ? (
              <>
                <LoaderCircle className="animate-spin" />
                Saving...
              </>
            ) : (
              "Show recommendations"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

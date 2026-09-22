"use client";

import type { CourseVisibility } from "@skillstream/shared";
import { Lock, Globe } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Icon-only Public/Private indicator for a course row — used in place of a
 *  full text Badge in the course-picker rows (manage-partner-courses-dialog,
 *  manage-org-courses-dialog), where title/category text is already tight on
 *  space. Hover/focus reveals the label via tooltip. */
export function CourseVisibilityIcon({ visibility }: { visibility: CourseVisibility }) {
  const isPrivate = visibility === "PRIVATE";
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className="shrink-0 text-muted-foreground"
            aria-label={isPrivate ? "Private course" : "Public course"}
          />
        }
      >
        {isPrivate ? <Lock className="h-4 w-4 text-primary" /> : <Globe className="h-4 w-4" />}
      </TooltipTrigger>
      <TooltipContent>{isPrivate ? "Private" : "Public"}</TooltipContent>
    </Tooltip>
  );
}

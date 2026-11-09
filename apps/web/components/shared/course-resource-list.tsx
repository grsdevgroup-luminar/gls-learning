"use client";

import type { CourseResourceDto } from "@grslearning/shared";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CourseResourceList({ resources }: { resources: CourseResourceDto[] }) {
  if (resources.length === 0) return null;
  return (
    <section className="mt-4 border-t bg-background p-4 md:p-6">
      <div className="mb-3">
        <h2 className="font-semibold">Course resources</h2>
        <p className="text-xs text-muted-foreground">Reference files provided for this course.</p>
      </div>
      <ul className="space-y-2">
        {resources.map((resource) => (
          <li key={resource.id} className="flex min-w-0 items-center gap-3 rounded-lg border p-3 text-sm">
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate" title={resource.name}>{resource.name}</span>
            {resource.sizeLabel && <span className="shrink-0 text-xs text-muted-foreground">{resource.sizeLabel}</span>}
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Download ${resource.name}`}
              render={<a href={resource.url} target="_blank" rel="noopener noreferrer" download />}
            >
              <Download className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

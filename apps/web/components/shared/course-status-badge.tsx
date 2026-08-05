import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CircleDot, Clock, Eye, FileText } from "lucide-react";
import type { CourseStatus } from "@skillstream/shared";

const META: Record<
  CourseStatus | "NEW",
  { label: string; className: string; icon: typeof Eye }
> = {
  PUBLISHED: { label: "Published", className: "text-success border-success/30 bg-success/10", icon: Eye },
  REVIEW: { label: "In review", className: "text-warning border-warning/30 bg-warning/10", icon: Clock },
  DRAFT: { label: "Draft", className: "text-muted-foreground", icon: FileText },
  NEW: { label: "Not submitted", className: "text-muted-foreground", icon: CircleDot },
};

export function CourseStatusBadge({
  status,
  className,
}: {
  status?: CourseStatus;
  className?: string;
}) {
  const meta = META[status ?? "NEW"];
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={cn("gap-1", meta.className, className)}>
      <Icon className="size-3" /> {meta.label}
    </Badge>
  );
}

export function courseStatusLabel(status?: CourseStatus) {
  return META[status ?? "NEW"].label;
}

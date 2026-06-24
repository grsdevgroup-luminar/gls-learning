import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CircleDot, Clock, Eye, FileText } from "lucide-react";
import type { CourseStatus } from "@/types";

const META: Record<
  CourseStatus | "new",
  { label: string; className: string; icon: typeof Eye }
> = {
  published: { label: "Published", className: "text-success border-success/30 bg-success/10", icon: Eye },
  review: { label: "In review", className: "text-warning border-warning/30 bg-warning/10", icon: Clock },
  draft: { label: "Draft", className: "text-muted-foreground", icon: FileText },
  new: { label: "Not submitted", className: "text-muted-foreground", icon: CircleDot },
};

export function CourseStatusBadge({
  status,
  className,
}: {
  status?: CourseStatus;
  className?: string;
}) {
  const meta = META[status ?? "new"];
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={cn("gap-1", meta.className, className)}>
      <Icon className="size-3" /> {meta.label}
    </Badge>
  );
}

export function courseStatusLabel(status?: CourseStatus) {
  return META[status ?? "new"].label;
}

import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, X } from "lucide-react";

export function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export const statusBadge = {
  PENDING: <Badge variant="outline" className="gap-1 text-warning border-warning/30 bg-warning/10"><Clock className="size-3" /> Pending</Badge>,
  APPROVED: <Badge variant="outline" className="gap-1 text-success border-success/30 bg-success/10"><CheckCircle2 className="size-3" /> Approved</Badge>,
  REJECTED: <Badge variant="outline" className="gap-1 text-destructive border-destructive/30 bg-destructive/10"><X className="size-3" /> Rejected</Badge>,
} as const;

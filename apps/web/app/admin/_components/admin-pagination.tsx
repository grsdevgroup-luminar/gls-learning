"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const ADMIN_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function paginationNumbers(current: number, total: number): Array<number | "..."> {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, 4, "...", total];
  if (current >= total - 2) return [1, "...", total - 3, total - 2, total - 1, total];
  return [1, "...", current - 1, current, current + 1, "...", total];
}

export function AdminRowsPerPage({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Rows per page</span>
      <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger className="w-20">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ADMIN_PAGE_SIZE_OPTIONS.map((n) => (
            <SelectItem key={n} value={String(n)}>
              {n}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function AdminPagination({
  page,
  totalPages,
  onPageChange,
  showSinglePage = false,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  showSinglePage?: boolean;
}) {
  if (totalPages <= 1 && !showSinglePage) return null;

  return (
    <div className="flex flex-col items-center justify-between gap-4 pt-2 sm:flex-row">
      <div className="text-sm text-muted-foreground">
        Page <span className="font-medium text-foreground">{page}</span> of{" "}
        <span className="font-medium text-foreground">{totalPages}</span>
      </div>
      <div className="flex items-center justify-center gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </Button>
        <div className="mx-1 flex items-center gap-1">
          {paginationNumbers(page, totalPages).map((n, i) =>
            n === "..." ? (
              <span key={`ellipsis-${i}`} className="px-2 text-sm text-muted-foreground">
                ...
              </span>
            ) : (
              <Button
                key={n}
                variant={n === page ? "default" : "outline"}
                size="sm"
                className="h-8 min-w-8 px-2"
                onClick={() => onPageChange(n)}
              >
                {n}
              </Button>
            ),
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        >
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

export function PageHeaderSkeleton({ action = false }: { action?: boolean }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-2">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      {action && <Skeleton className="h-9 w-28" />}
    </div>
  );
}

export function CourseGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-xl border bg-card">
          <Skeleton className="aspect-[16/9] w-full rounded-none" />
          <div className="space-y-3 p-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-4 w-full" />
            <div className="flex items-center justify-between pt-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-16" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ columns = 5, rows = 5 }: { columns?: number; rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="grid gap-4 border-b bg-muted/30 p-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }).map((_, index) => <Skeleton key={index} className="h-3 w-3/4" />)}
      </div>
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="grid gap-4 border-b p-4 last:border-b-0" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }).map((_, column) => <Skeleton key={column} className="h-5 w-full" />)}
        </div>
      ))}
    </div>
  );
}

export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-5">
      {Array.from({ length: fields }).map((_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className={index === fields - 1 ? "h-24 w-full" : "h-10 w-full"} />
        </div>
      ))}
      <Skeleton className="h-10 w-32" />
    </div>
  );
}

export function AuthFormSkeleton() {
  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-16">
      <div className="space-y-2 text-center"><Skeleton className="mx-auto h-8 w-40" /><Skeleton className="mx-auto h-4 w-64" /></div>
      <div className="rounded-xl border p-6"><FormSkeleton fields={3} /></div>
    </div>
  );
}

export function CheckoutSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeaderSkeleton />
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6"><Skeleton className="h-40 w-full rounded-xl" /><Skeleton className="h-80 w-full rounded-xl" /><Skeleton className="h-16 w-full rounded-xl" /></div>
        <Skeleton className="h-[28rem] w-full rounded-xl" />
      </div>
    </div>
  );
}

export function LearningSkeleton() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5"><Skeleton className="aspect-video w-full rounded-xl" /><Skeleton className="h-8 w-3/5" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /></div>
        <div className="space-y-3 rounded-xl border p-4"><Skeleton className="h-6 w-1/2" />{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}</div>
      </div>
    </div>
  );
}

export function DiscussionSkeleton() {
  return (
    <div className="space-y-5">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="flex gap-3"><Skeleton className="size-9 shrink-0 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /></div></div>
      ))}
    </div>
  );
}

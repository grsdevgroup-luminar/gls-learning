import { CourseGridSkeleton } from "@/components/shared/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function CoursesLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 space-y-2"><Skeleton className="h-9 w-40" /><Skeleton className="h-4 w-56" /></div>
      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside className="hidden space-y-4 lg:block"><Skeleton className="h-8 w-24" />{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)}</aside>
        <CourseGridSkeleton />
      </div>
    </div>
  );
}

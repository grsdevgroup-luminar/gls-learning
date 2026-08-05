import { Skeleton } from "@/components/ui/skeleton";

export default function StorefrontLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-10">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-4 w-1/2" />
      <div className="grid grid-cols-1 gap-5 pt-6 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

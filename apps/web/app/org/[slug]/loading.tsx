import { Skeleton } from "@/components/ui/skeleton";

export default function OrgLoading() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-7 w-1/4" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

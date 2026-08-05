import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, SearchX } from "lucide-react";

export default function CourseNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
        <SearchX className="size-6" />
      </div>
      <h1 className="text-xl font-semibold">Course not found</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        This course may have been removed or is no longer available.
      </p>
      <Button className="mt-2" render={<Link href="/courses" />}>
        Browse courses <ArrowRight />
      </Button>
    </div>
  );
}

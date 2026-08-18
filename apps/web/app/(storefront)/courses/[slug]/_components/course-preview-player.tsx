"use client";

import { useSession } from "@/lib/api/session";
import { ProtectedPlayer } from "@/components/player/protected-player";
import { PlayCircle } from "lucide-react";
import type { LessonPublicDto } from "@skillstream/shared";

/** Only the watermark (viewer email) is session-dependent — everything else
 *  about which lesson previews is static, decided server-side by the parent. */
export function CoursePreviewPlayer({
  lesson,
  seed,
}: {
  lesson: LessonPublicDto;
  seed: string;
}) {
  const { user } = useSession();
  const watermark = user?.email ?? "preview@grs-learning";

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <PlayCircle className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Free preview</h2>
      </div>
      <ProtectedPlayer
        lessonId={lesson.id}
        title={lesson.title}
        watermark={watermark}
        seed={seed}
      />
    </div>
  );
}

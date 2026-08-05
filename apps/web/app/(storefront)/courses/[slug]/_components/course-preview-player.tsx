"use client";

import { useSession } from "@/lib/api/session";
import { ProtectedPlayer } from "@/components/player/protected-player";
import { Badge } from "@/components/ui/badge";
import { PlayCircle, ShieldCheck } from "lucide-react";
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
  const watermark = user?.email ?? "preview@SkillStream";

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <PlayCircle className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Free preview</h2>
        <Badge variant="outline" className="ml-1 gap-1">
          <ShieldCheck className="h-3 w-3" /> Protected stream
        </Badge>
      </div>
      <ProtectedPlayer
        lessonId={lesson.id}
        title={lesson.title}
        watermark={watermark}
        seed={seed}
      />
      <p className="mt-2 text-xs text-muted-foreground">
        Demo: video is DRM-streamed with a per-student moving watermark,
        disabled right-click, and no downloadable source. Real builds use
        signed HLS + Widevine/FairPlay.
      </p>
    </div>
  );
}

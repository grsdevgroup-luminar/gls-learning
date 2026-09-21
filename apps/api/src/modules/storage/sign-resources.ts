import type { CourseDetailDto, LessonResourceDto } from "@skillstream/shared";
import type { StorageDriver } from "./storage.driver";

/**
 * Rewrites lesson resource URLs in-place to fresh (signed) URLs from the
 * storage driver. Called after `toCourseDetail` — the mapper stays sync, this
 * post-processor stays async. Resources without a `storageKey` are treated as
 * bare links and left alone. Failed signings drop the resource so a bad
 * bucket key never blocks the rest of the course from rendering.
 */
export async function signCourseResourceUrls(
  detail: CourseDetailDto,
  storage: StorageDriver,
): Promise<CourseDetailDto> {
  await Promise.all(
    detail.sections.flatMap((section) =>
      section.lessons.map(async (lesson) => {
        const resolved = await Promise.all(
          lesson.resources.map((r) => signOne(r, storage)),
        );
        if (lesson.pptx) {
          const key = lesson.pptx.storageKey;
          if (key) { lesson.pptx.url = await storage.getUrl(key); delete lesson.pptx.storageKey; }
        }
        lesson.resources = resolved.filter(
          (r): r is LessonResourceDto => r !== null,
        );
      }),
    ),
  );
  return detail;
}

async function signOne(
  resource: LessonResourceDto,
  storage: StorageDriver,
): Promise<LessonResourceDto | null> {
  if (!resource.storageKey) return resource;
  try {
    const url = await storage.getUrl(resource.storageKey);
    return { ...resource, url };
  } catch {
    // Never render a broken download link; log-and-drop.
    return null;
  }
}

import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type { LessonResourceDto } from "@skillstream/shared";
import { ulid } from "ulid";
import type { RequestUser } from "../../common/decorators/decorators";
import { AuthoringRepository } from "./authoring.repository";
import {
  RESOURCE_KEY_PREFIX,
  PPTX_KEY_PREFIX,
  STORAGE_DRIVER,
} from "../storage/storage.constants";
import type { StorageDriver } from "../storage/storage.driver";
import type { ValidatedResourceFile } from "./pipes/resource-file.pipe";

/** Matches the shared `lessonResourceSchema.resources.max(20)`. */
const RESOURCE_LIMIT_PER_LESSON = 20;

@Injectable()
export class LessonResourceService {
  private readonly logger = new Logger(LessonResourceService.name);

  constructor(
    private readonly repo: AuthoringRepository,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
  ) {}

  /** Owner/admin check + returns the lesson row for downstream repo calls. */
  private async assertLessonAccess(lessonId: string, user: RequestUser) {
    const lesson = await this.repo.findLessonCourseId(lessonId);
    if (!lesson) throw new NotFoundException("Lesson not found");
    const course = await this.repo.findCourseInstructor(lesson.section.courseId);
    if (!course) throw new NotFoundException("Course not found");
    if (user.role !== "ADMIN" && course.instructorId !== user.id) {
      throw new ForbiddenException("Not your lesson");
    }
    return lesson;
  }

  async upload(
    user: RequestUser,
    lessonId: string,
    file: ValidatedResourceFile,
  ): Promise<LessonResourceDto> {
    await this.assertLessonAccess(lessonId, user);

    // Key layout: resources/{lessonId}/{ulid}.{ext} — same for local + S3 so
    // swapping the driver never changes what the DB stores.
    const key = `${RESOURCE_KEY_PREFIX}/${lessonId}/${ulid()}.${file.extension}`;

    const stored = await this.storage.put({
      key,
      body: file.buffer,
      contentType: file.mimeType,
      contentLength: file.size,
      originalName: file.originalName,
    });

    const resource = {
      name: file.originalName,
      url: stored.url,
      sizeLabel: humanSize(file.size),
      storageKey: stored.key,
    };

    try {
      await this.repo.appendLessonResource(
        lessonId,
        resource,
        RESOURCE_LIMIT_PER_LESSON,
      );
    } catch (err) {
      // Best-effort cleanup so we don't leak a bucket object when the DB
      // update refuses (e.g. limit reached in a race).
      await this.storage.delete(stored.key).catch((e) => {
        this.logger.warn(
          `Orphan cleanup failed for ${stored.key}: ${(e as Error).message}`,
        );
      });
      if ((err as Error).message === "RESOURCE_LIMIT_REACHED") {
        throw new BadRequestException(
          `Lesson already has the maximum of ${RESOURCE_LIMIT_PER_LESSON} resources`,
        );
      }
      throw err;
    }

    return resource;
  }

  async uploadPptx(user: RequestUser, lessonId: string, file: ValidatedResourceFile, durationSec: number) {
    const lesson = await this.assertLessonAccess(lessonId, user);
    if (lesson.type !== "VIDEO") throw new BadRequestException("PowerPoint slides can only be attached to video lessons");
    const prior = await this.repo.findLessonPptx(lessonId);
    const key = `${PPTX_KEY_PREFIX}/${lessonId}/${ulid()}.pptx`;
    const stored = await this.storage.put({ key, body: file.buffer, contentType: file.mimeType, contentLength: file.size, originalName: file.originalName });
    try {
      await this.repo.updateLessonPptx(lessonId, { pptxStorageKey: stored.key, pptxName: file.originalName, pptxSizeLabel: humanSize(file.size), pptxDurationSec: durationSec });
    } catch (err) {
      await this.storage.delete(stored.key).catch(() => undefined); throw err;
    }
    if (prior?.pptxStorageKey) await this.storage.delete(prior.pptxStorageKey).catch(() => undefined);
    return { name: file.originalName, sizeLabel: humanSize(file.size), durationSec };
  }

  async removePptx(user: RequestUser, lessonId: string) {
    const lesson = await this.assertLessonAccess(lessonId, user);
    if (lesson.type !== "VIDEO") throw new BadRequestException("PowerPoint slides can only be attached to video lessons");
    const prior = await this.repo.findLessonPptx(lessonId);
    // DELETE is intentionally idempotent: the client may be clearing a draft
    // flag for a lesson that never had a server-side PPTX, or racing another
    // successful removal. Access and lesson-type checks above still apply.
    if (!prior?.pptxStorageKey) return { ok: true };
    await this.repo.updateLessonPptx(lessonId, { pptxStorageKey: null, pptxName: null, pptxSizeLabel: null, pptxDurationSec: 0 });
    await this.storage.delete(prior.pptxStorageKey).catch(() => undefined);
    return { ok: true };
  }

  async remove(
    user: RequestUser,
    lessonId: string,
    storageKey: string,
  ): Promise<{ ok: true }> {
    await this.assertLessonAccess(lessonId, user);
    const { removed } = await this.repo.removeLessonResourceByStorageKey(
      lessonId,
      storageKey,
    );
    if (!removed) throw new NotFoundException("Resource not found");
    // DB row is gone; the object is best-effort. Log and continue on failure
    // so a stale bucket object never blocks the instructor's UI.
    await this.storage.delete(storageKey).catch((err) => {
      this.logger.warn(
        `Storage delete failed for ${storageKey}: ${(err as Error).message}`,
      );
    });
    return { ok: true };
  }
}

/** Bytes → "1.2 MB" style, matching the frontend format-bytes util. Kept here
 *  so the DB persists the label alongside the file; the reader doesn't have
 *  to reformat on every render. */
function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIdx = 0;
  while (value >= 1024 && unitIdx < units.length - 1) {
    value /= 1024;
    unitIdx += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIdx]}`;
}

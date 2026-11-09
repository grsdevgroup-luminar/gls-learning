import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { CourseResourceDto } from "@skillstream/shared";
import { ulid } from "ulid";
import type { RequestUser } from "../../common/decorators/decorators";
import { AuthoringRepository } from "./authoring.repository";
import { COURSE_RESOURCE_KEY_PREFIX, STORAGE_DRIVER } from "../storage/storage.constants";
import type { StorageDriver } from "../storage/storage.driver";
import type { ValidatedResourceFile } from "./pipes/resource-file.pipe";

const COURSE_RESOURCE_LIMIT = 50;

@Injectable()
export class CourseResourceService {
  constructor(
    private readonly repo: AuthoringRepository,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
  ) {}

  private async assertCourseAccess(courseId: string, user: RequestUser) {
    const course = await this.repo.findCourseInstructor(courseId);
    if (!course) throw new NotFoundException("Course not found");
    if (user.role !== "ADMIN" && course.instructorId !== user.id) {
      throw new ForbiddenException("Not your course");
    }
    if (user.role !== "ADMIN" && course.status === "PUBLISHED" && !course.revisionOfId) {
      throw new ConflictException(
        "Published courses must be edited as a revision and submitted for review",
      );
    }
    if (user.role !== "ADMIN" && course.revisionOfId && course.status === "REVIEW") {
      throw new ConflictException("This revision is pending admin review and can no longer be edited");
    }
    return course;
  }

  async upload(
    user: RequestUser,
    courseId: string,
    file: ValidatedResourceFile,
  ): Promise<CourseResourceDto> {
    await this.assertCourseAccess(courseId, user);
    const count = await this.repo.countCourseResources(courseId);
    if (count >= COURSE_RESOURCE_LIMIT) {
      throw new ConflictException(`A course can have at most ${COURSE_RESOURCE_LIMIT} resources`);
    }

    const key = `${COURSE_RESOURCE_KEY_PREFIX}/${courseId}/${ulid()}.${file.extension}`;
    const stored = await this.storage.put({
      key,
      body: file.buffer,
      contentType: file.mimeType,
      contentLength: file.size,
      originalName: file.originalName,
    });
    try {
      const resource = await this.repo.createCourseResource({
        courseId,
        name: file.originalName,
        storageKey: stored.key,
        mimeType: file.mimeType,
        sizeBytes: BigInt(file.size),
        sizeLabel: humanSize(file.size),
        order: count,
      });
      return {
        id: resource.id,
        name: resource.name,
        url: stored.url,
        mimeType: resource.mimeType,
        sizeLabel: resource.sizeLabel,
        order: resource.order,
        storageKey: resource.storageKey,
      };
    } catch (error) {
      await this.storage.delete(stored.key).catch(() => undefined);
      throw error;
    }
  }

  async remove(user: RequestUser, courseId: string, resourceId: string) {
    await this.assertCourseAccess(courseId, user);
    const resource = await this.repo.findCourseResource(courseId, resourceId);
    if (!resource) throw new NotFoundException("Course resource not found");
    await this.repo.deleteCourseResource(courseId, resourceId);
    await this.storage.delete(resource.storageKey).catch(() => undefined);
    return { ok: true as const };
  }
}

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

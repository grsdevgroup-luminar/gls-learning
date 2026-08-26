import { ConflictException, ForbiddenException } from "@nestjs/common";
import { UploadStatus } from "@prisma/client";

/** Upload statuses a lesson may reference when saving cfVideoUid. */
export const ATTACHABLE_UPLOAD_STATUSES: UploadStatus[] = [
  UploadStatus.PROCESSING,
  UploadStatus.READY,
];

export interface AttachableUploadRow {
  ownerUserId: string;
  cloudflareUid: string | null;
  courseId: string | null;
  lessonId: string | null;
  status: UploadStatus;
}

export interface AssertAttachableUploadInput {
  uid: string;
  userId: string;
  courseId: string;
  lessonId?: string;
}

/**
 * Pure ownership/attachability rules for linking a Cloudflare UID to a lesson.
 * Admins follow the same ownership rules — no cross-instructor attachment.
 */
export function assertAttachableUpload(
  upload: AttachableUploadRow | null,
  input: AssertAttachableUploadInput,
): void {
  if (!upload || upload.cloudflareUid !== input.uid) {
    throw new ForbiddenException("Video upload not found or not authorized");
  }

  if (upload.ownerUserId !== input.userId) {
    throw new ForbiddenException("Video upload not found or not authorized");
  }

  if (!ATTACHABLE_UPLOAD_STATUSES.includes(upload.status)) {
    throw new ForbiddenException(
      `Video upload is not ready to attach (status: ${upload.status})`,
    );
  }

  if (upload.lessonId && upload.lessonId !== input.lessonId) {
    throw new ForbiddenException("Video upload is already attached to another lesson");
  }

  if (upload.courseId && upload.courseId !== input.courseId) {
    throw new ForbiddenException("Video upload belongs to a different course");
  }
}

export function isAttachableStatus(status: UploadStatus): boolean {
  return ATTACHABLE_UPLOAD_STATUSES.includes(status);
}

/** Rejects discard when an upload is already linked to a lesson row. */
export function assertDiscardableUpload(upload: { lessonId: string | null }): void {
  if (upload.lessonId) {
    throw new ConflictException(
      "Cannot discard an upload attached to a lesson — remove or replace the lesson video first",
    );
  }
}

import { Injectable } from "@nestjs/common";
import { Prisma, UploadStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { Db } from "../../common/types";

/** Statuses that may still advance to READY or FAILED (encoding lifecycle). */
export const ENCODING_TRANSITION_STATUSES: UploadStatus[] = [
  UploadStatus.CREATED,
  UploadStatus.UPLOADING,
  UploadStatus.PROCESSING,
];

@Injectable()
export class UploadRepository {
  constructor(private readonly prisma: PrismaService) {}

  private db(tx?: Db) {
    return tx ?? this.prisma;
  }

  findByCloudflareUid(cloudflareUid: string) {
    return this.prisma.upload.findUnique({ where: { cloudflareUid } });
  }

  findByIdAndOwner(uploadId: string, ownerUserId: string) {
    return this.prisma.upload.findFirst({
      where: { id: uploadId, ownerUserId },
    });
  }

  updateAfterCfInit(
    uploadId: string,
    data: {
      cloudflareUid: string;
      tusUploadUrl: string;
      expiresAt: Date;
    },
    tx?: Db,
  ) {
    return this.db(tx).upload.update({
      where: { id: uploadId },
      data: {
        cloudflareUid: data.cloudflareUid,
        tusUploadUrl: data.tusUploadUrl,
        expiresAt: data.expiresAt,
        status: UploadStatus.UPLOADING,
      },
    });
  }

  markFailed(uploadId: string, reason: string, tx?: Db) {
    return this.db(tx).upload.update({
      where: { id: uploadId },
      data: { status: UploadStatus.FAILED, failureReason: reason },
    });
  }

  markProcessing(uploadId: string, tx?: Db) {
    return this.db(tx).upload.update({
      where: { id: uploadId },
      data: {
        status: UploadStatus.PROCESSING,
        completedAt: new Date(),
      },
    });
  }

  markReady(uploadId: string, tx?: Db) {
    return this.db(tx).upload.update({
      where: { id: uploadId },
      data: {
        status: UploadStatus.READY,
        completedAt: new Date(),
        readyAt: new Date(),
      },
    });
  }

  /** Atomically marks READY only from a non-terminal encoding state. */
  async markReadyFromEncoding(uploadId: string, tx?: Db): Promise<boolean> {
    const result = await this.db(tx).upload.updateMany({
      where: {
        id: uploadId,
        status: { in: ENCODING_TRANSITION_STATUSES },
      },
      data: {
        status: UploadStatus.READY,
        completedAt: new Date(),
        readyAt: new Date(),
      },
    });
    return result.count > 0;
  }

  /** Atomically marks FAILED only from a non-terminal encoding state. */
  async markFailedFromEncoding(
    uploadId: string,
    reason: string,
    tx?: Db,
  ): Promise<boolean> {
    const result = await this.db(tx).upload.updateMany({
      where: {
        id: uploadId,
        status: { in: ENCODING_TRANSITION_STATUSES },
      },
      data: {
        status: UploadStatus.FAILED,
        failureReason: reason,
      },
    });
    return result.count > 0;
  }

  markAbandoned(uploadId: string, tx?: Db) {
    return this.db(tx).upload.update({
      where: { id: uploadId },
      data: { status: UploadStatus.ABANDONED },
    });
  }

  countOutstandingByOwner(ownerUserId: string) {
    return this.prisma.upload.count({
      where: {
        ownerUserId,
        status: { in: [UploadStatus.CREATED, UploadStatus.UPLOADING] },
      },
    });
  }

  create(data: Prisma.UploadUncheckedCreateInput, tx?: Db) {
    return this.db(tx).upload.create({ data });
  }

  attachToLesson(
    cloudflareUid: string,
    lessonId: string,
    courseId: string,
    tx?: Db,
  ) {
    return this.db(tx).upload.update({
      where: { cloudflareUid },
      data: { lessonId, courseId },
    });
  }

  detachFromLesson(cloudflareUid: string, tx?: Db) {
    return this.db(tx).upload.update({
      where: { cloudflareUid },
      data: { lessonId: null },
    });
  }

  findLessonCfVideoUid(lessonId: string) {
    return this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { cfVideoUid: true },
    });
  }
}

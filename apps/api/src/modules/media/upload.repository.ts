import { Injectable } from "@nestjs/common";
import { Prisma, UploadStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { Db } from "../../common/types";

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

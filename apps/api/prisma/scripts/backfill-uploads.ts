/**
 * Backfills Upload rows for lessons that already have cfVideoUid from before the
 * tus ownership model. Safe to re-run: skips existing cloudflareUid records and
 * links lessonId when missing.
 *
 * Usage: pnpm --filter @skillstream/api prisma:backfill-uploads
 */
import { PrismaClient, UploadStatus } from "@prisma/client";

const prisma = new PrismaClient();
const LEGACY_EXPIRES_AT = new Date("2099-01-01T00:00:00.000Z");

async function main() {
  const lessons = await prisma.lesson.findMany({
    where: { cfVideoUid: { not: null } },
    select: {
      id: true,
      title: true,
      cfVideoUid: true,
      section: {
        select: {
          courseId: true,
          course: { select: { instructorId: true } },
        },
      },
    },
  });

  let created = 0;
  let linked = 0;
  let skipped = 0;

  for (const lesson of lessons) {
    const uid = lesson.cfVideoUid!;
    const existing = await prisma.upload.findUnique({
      where: { cloudflareUid: uid },
    });

    if (existing) {
      if (!existing.lessonId) {
        await prisma.upload.update({
          where: { id: existing.id },
          data: {
            lessonId: lesson.id,
            courseId: lesson.section.courseId,
          },
        });
        linked += 1;
      } else {
        skipped += 1;
      }
      continue;
    }

    await prisma.upload.create({
      data: {
        ownerUserId: lesson.section.course.instructorId,
        cloudflareUid: uid,
        courseId: lesson.section.courseId,
        lessonId: lesson.id,
        filename: `${lesson.title.slice(0, 180).replace(/[^\w.-]+/g, "_") || "legacy"}.mp4`,
        bytes: BigInt(0),
        status: UploadStatus.READY,
        expiresAt: LEGACY_EXPIRES_AT,
        readyAt: new Date(),
      },
    });
    created += 1;
  }

  console.log(
    JSON.stringify({
      lessonsWithVideo: lessons.length,
      created,
      linked,
      skipped,
    }),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

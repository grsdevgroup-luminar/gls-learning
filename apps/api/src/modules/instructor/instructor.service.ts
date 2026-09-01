import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InstructorApplication, Prisma } from "@prisma/client";
import type {
  AdminInstructorApplicationQuery,
  AdminInstructorQuery,
  ApplyInstructorInput,
  InstructorApplicationDto,
  InstructorApplicationStatsDto,
  InstructorCvUploadDto,
  InstructorProfileDto,
  InstructorPublicProfileDto,
  InstructorRosterDto,
  Paginated,
  UpdateInstructorProfileInput,
} from "@skillstream/shared";
import { ulid } from "ulid";
import type { RequestUser } from "../../common/decorators/decorators";
import { PrismaService } from "../../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import {
  NotificationsService,
  type NotifyInput,
} from "../notifications/notifications.service";
import { CV_KEY_PREFIX, STORAGE_DRIVER } from "../storage/storage.constants";
import type { StorageDriver } from "../storage/storage.driver";
import { InstructorRepository } from "./instructor.repository";
import type { ValidatedCvFile } from "./pipes/cv-file.pipe";

const approvedNotify = (userId: string): NotifyInput => ({
  userId,
  event: "INSTRUCTOR_APPLICATION_APPROVED",
  title: "Instructor application approved",
  body: "You're approved as an instructor — you can start building courses.",
  href: "/instructor",
});

@Injectable()
export class InstructorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: InstructorRepository,
    private readonly email: EmailService,
    private readonly notifications: NotificationsService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
  ) {}

  /** Applicants are promised an emailed decision; a delivery failure must not
   *  undo the approval, so this is fire-and-forget. */
  private notifyDecision(
    app: { email: string; name: string },
    approved: boolean,
    note?: string | null,
  ): void {
    void this.email
      .sendApplicationDecision(app.email, app.name, "instructor", approved, note)
      .catch(() => undefined);
  }

  /** Re-resolves the CV's URL through the storage driver on every read (the
   *  key is what's durable; a signed S3 URL minted at upload time may have
   *  expired by the time an admin opens the application — same reasoning as
   *  the avatar re-resolve in AuthService). */
  private async toAppDto(a: InstructorApplication): Promise<InstructorApplicationDto> {
    const cvUrl = a.cvKey
      ? await this.storage.getUrl(a.cvKey).catch(() => null)
      : null;
    return {
      id: a.id,
      name: a.name,
      email: a.email,
      expertise: a.expertise,
      headline: a.headline,
      bio: a.bio,
      sampleUrl: a.sampleUrl,
      linkedinUrl: a.linkedinUrl,
      twitterUrl: a.twitterUrl,
      youtubeUrl: a.youtubeUrl,
      facebookUrl: a.facebookUrl,
      otherUrl: a.otherUrl,
      cvName: a.cvName,
      cvUrl,
      cvSizeLabel: a.cvSizeLabel,
      status: a.status,
      appliedAt: a.appliedAt.toISOString(),
      reviewedAt: a.reviewedAt?.toISOString() ?? null,
      note: a.note,
    };
  }

  async apply(
    user: RequestUser,
    input: ApplyInstructorInput,
  ): Promise<InstructorApplicationDto> {
    const dbUser = await this.repo.findUserByIdOrThrow(user.id);
    const pending = await this.repo.findPendingApplication(user.id);
    if (pending) throw new BadRequestException("You already have a pending application");

    // The CV was uploaded in a separate multipart request before this JSON
    // body was submitted — the client only carries the key forward, so make
    // sure it actually belongs to this user rather than trusting it blindly
    // (the key namespace is `cvs/{userId}/...`, so a mismatch means either a
    // bug or a tampered request).
    if (input.cvKey && !input.cvKey.startsWith(`${CV_KEY_PREFIX}/${user.id}/`)) {
      throw new BadRequestException("Invalid CV reference");
    }

    const app = await this.repo.createApplication({
      userId: user.id,
      name: dbUser.name,
      email: dbUser.email,
      expertise: input.expertise,
      headline: input.headline,
      bio: input.bio,
      sampleUrl: input.sampleUrl,
      linkedinUrl: input.linkedinUrl,
      twitterUrl: input.twitterUrl,
      youtubeUrl: input.youtubeUrl,
      facebookUrl: input.facebookUrl,
      otherUrl: input.otherUrl,
      cvKey: input.cvKey,
      cvName: input.cvName,
      cvSizeLabel: input.cvSizeLabel,
      status: "PENDING",
    });
    return this.toAppDto(app);
  }

  async uploadCv(user: RequestUser, file: ValidatedCvFile): Promise<InstructorCvUploadDto> {
    const key = `${CV_KEY_PREFIX}/${user.id}/${ulid()}.${file.extension}`;
    const stored = await this.storage.put({
      key,
      body: file.buffer,
      contentType: file.mimeType,
      contentLength: file.size,
      originalName: file.originalName,
    });
    return {
      key: stored.key,
      name: file.originalName,
      url: stored.url,
      sizeLabel: humanSize(file.size),
    };
  }

  async deleteCv(user: RequestUser, key: string): Promise<{ ok: true }> {
    if (!key.startsWith(`${CV_KEY_PREFIX}/${user.id}/`)) {
      throw new ForbiddenException("Not your file");
    }
    await this.storage.delete(key);
    return { ok: true };
  }

  /** Approved instructors, best-rated first — powers the public roster. */
  async roster(): Promise<InstructorRosterDto[]> {
    const rows = await this.repo.findApprovedInstructorsRoster();
    return rows.map((u) => ({
      id: u.id,
      name: u.name,
      avatar: u.avatar,
      title: u.instructorProfile?.title ?? "",
      bio: u.instructorProfile?.bio ?? "",
      ratingAvg: u.instructorProfile?.ratingAvg ?? 0,
      studentCount: u.instructorProfile?.studentCount ?? 0,
      courseCount: u.instructorProfile?.courseCount ?? 0,
    }));
  }

  async publicProfile(id: string): Promise<InstructorPublicProfileDto> {
    const u = await this.repo.findApprovedProfileByUserId(id);
    if (!u?.instructorProfile) throw new NotFoundException("Instructor not found");
    const p = u.instructorProfile;
    return {
      id: u.id,
      name: u.name,
      avatar: u.avatar,
      title: p.title,
      bio: p.bio,
      expertise: p.expertise,
      ratingAvg: p.ratingAvg,
      studentCount: p.studentCount,
      courseCount: p.courseCount,
      joinedAt: u.createdAt.toISOString(),
      sampleUrl: p.sampleUrl,
      linkedinUrl: p.linkedinUrl,
      twitterUrl: p.twitterUrl,
      youtubeUrl: p.youtubeUrl,
      facebookUrl: p.facebookUrl,
      otherUrl: p.otherUrl,
    };
  }

  /** An InstructorProfile row only exists once an application is approved,
   *  so a pending or rejected applicant would otherwise see `null` here and
   *  the frontend's ApprovalGate would show "not an instructor yet" instead
   *  of their actual status. */
  async myProfile(user: RequestUser): Promise<InstructorProfileDto | null> {
    const u = await this.repo.findUserWithProfile(user.id);
    if (u?.instructorProfile) {
      const p = u.instructorProfile;
      return {
        userId: u.id,
        name: u.name,
        email: u.email,
        avatar: u.avatar,
        title: p.title,
        bio: p.bio,
        expertise: p.expertise,
        ratingAvg: p.ratingAvg,
        studentCount: p.studentCount,
        courseCount: p.courseCount,
        earningsCents: p.earningsCents,
        status: p.status,
        sampleUrl: p.sampleUrl,
        linkedinUrl: p.linkedinUrl,
        twitterUrl: p.twitterUrl,
        youtubeUrl: p.youtubeUrl,
        facebookUrl: p.facebookUrl,
        otherUrl: p.otherUrl,
        joinedAt: u.createdAt.toISOString(),
      };
    }

    const app = await this.repo.findLatestApplicationByUser(user.id);
    if (!app || app.status === "APPROVED") return null;

    return {
      userId: user.id,
      name: app.name,
      email: app.email,
      avatar: null,
      title: app.headline,
      bio: app.bio,
      expertise: app.expertise,
      ratingAvg: 0,
      studentCount: 0,
      courseCount: 0,
      earningsCents: 0,
      status: app.status,
      sampleUrl: app.sampleUrl,
      linkedinUrl: app.linkedinUrl,
      twitterUrl: app.twitterUrl,
      youtubeUrl: app.youtubeUrl,
      facebookUrl: app.facebookUrl,
      otherUrl: app.otherUrl,
    };
  }

  async updateProfile(
    user: RequestUser,
    input: UpdateInstructorProfileInput,
  ): Promise<InstructorProfileDto> {
    if (input.avatar !== undefined)
      await this.repo.updateUserAvatar(user.id, input.avatar);
    // Link fields are "clearable": "" means remove the link (-> null),
    // omitted means leave it untouched, anything else is the new value.
    const nullableUrl = (v?: string) => (v === undefined ? undefined : v || null);
    await this.repo.updateInstructorProfile(user.id, {
      title: input.title,
      bio: input.bio,
      expertise: input.expertise,
      sampleUrl: nullableUrl(input.sampleUrl),
      linkedinUrl: nullableUrl(input.linkedinUrl),
      twitterUrl: nullableUrl(input.twitterUrl),
      youtubeUrl: nullableUrl(input.youtubeUrl),
      facebookUrl: nullableUrl(input.facebookUrl),
      otherUrl: nullableUrl(input.otherUrl),
    });
    const profile = await this.myProfile(user);
    if (!profile) throw new NotFoundException("Instructor profile not found");
    return profile;
  }

  // ── admin ──────────────────────────────────────────────────────────────
  async listApplications(
    query: AdminInstructorApplicationQuery,
  ): Promise<Paginated<InstructorApplicationDto>> {
    const where: Prisma.InstructorApplicationWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: "insensitive" } },
              { email: { contains: query.q, mode: "insensitive" } },
              { headline: { contains: query.q, mode: "insensitive" } },
              { expertise: { contains: query.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.repo.findApplicationsPage(
      where,
      query.page,
      query.pageSize,
    );
    return {
      items: await Promise.all(rows.map((a) => this.toAppDto(a))),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async applicationStats(): Promise<InstructorApplicationStatsDto> {
    const [pending, approved, rejected] = await this.repo.applicationStatusCounts();
    return { pending, approved, rejected };
  }

  async adminRoster(query: AdminInstructorQuery): Promise<Paginated<InstructorProfileDto>> {
    const where: Prisma.UserWhereInput = {
      instructorProfile: {
        status: "APPROVED",
        ...(query.expertise ? { expertise: query.expertise } : {}),
      },
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: "insensitive" } },
              { email: { contains: query.q, mode: "insensitive" } },
              { instructorProfile: { title: { contains: query.q, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.repo.findInstructorProfilesPage(
      where,
      query.page,
      query.pageSize,
    );
    return {
      items: rows.map((u) => {
        const p = u.instructorProfile!;
        return {
          userId: u.id,
          name: u.name,
          email: u.email,
          avatar: u.avatar,
          title: p.title,
          bio: p.bio,
          expertise: p.expertise,
          ratingAvg: p.ratingAvg,
          studentCount: p.studentCount,
          courseCount: p.courseCount,
          earningsCents: p.earningsCents,
          status: p.status,
          sampleUrl: p.sampleUrl,
          linkedinUrl: p.linkedinUrl,
          twitterUrl: p.twitterUrl,
          youtubeUrl: p.youtubeUrl,
          facebookUrl: p.facebookUrl,
          otherUrl: p.otherUrl,
          joinedAt: u.createdAt.toISOString(),
        };
      }),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async approve(appId: string, note?: string): Promise<InstructorApplicationDto> {
    const app = await this.repo.findApplicationById(appId);
    if (!app) throw new NotFoundException("Application not found");

    const updated = await this.prisma.$transaction(async (tx) => {
      const a = await this.repo.updateApplication(
        appId,
        { status: "APPROVED", reviewedAt: new Date(), note },
        tx,
      );
      if (app.userId) {
        await this.repo.updateUserRole(app.userId, "INSTRUCTOR", tx);
        const socialLinks = {
          sampleUrl: app.sampleUrl,
          linkedinUrl: app.linkedinUrl,
          twitterUrl: app.twitterUrl,
          youtubeUrl: app.youtubeUrl,
          facebookUrl: app.facebookUrl,
          otherUrl: app.otherUrl,
        };
        await this.repo.upsertInstructorProfile(
          app.userId,
          {
            status: "APPROVED",
            title: app.headline,
            bio: app.bio,
            expertise: app.expertise,
            ...socialLinks,
          },
          {
            userId: app.userId,
            status: "APPROVED",
            title: app.headline,
            bio: app.bio,
            expertise: app.expertise,
            ...socialLinks,
          },
          tx,
        );
      }
      if (app.userId) {
        await this.notifications.notify(approvedNotify(app.userId), tx);
      }
      return a;
    });
    this.notifyDecision(updated, true, note);
    if (app.userId) {
      void this.notifications
        .notifyEmailAfterCommit(approvedNotify(app.userId))
        .catch(() => undefined);
    }
    return this.toAppDto(updated);
  }

  async reject(appId: string, note: string): Promise<InstructorApplicationDto> {
    const app = await this.repo.updateApplication(appId, {
      status: "REJECTED",
      reviewedAt: new Date(),
      note,
    });
    this.notifyDecision(app, false, note);
    if (app.userId) {
      void this.notifications
        .notify({
          userId: app.userId,
          event: "INSTRUCTOR_APPLICATION_REJECTED",
          title: "Instructor application update",
          body: note,
          // Same destination as the approval notification (/instructor) — it
          // shows the rejection reason and a "Re-apply" action, so this stays
          // a real link instead of a dead-end informational notification.
          href: "/instructor",
        })
        .catch(() => undefined);
    }
    return this.toAppDto(app);
  }
}

/** Bytes → "1.2 MB" style. Mirrors the identical helper in
 *  LessonResourceService — small enough that sharing isn't worth a new
 *  module, and both are read once at upload time. */
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

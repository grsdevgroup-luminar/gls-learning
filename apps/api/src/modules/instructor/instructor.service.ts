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
  InstructorNameChangeRequestDto,
  NameChangeRequestQuery,
  RequestInstructorNameChangeInput,
  InstructorApplicationStatsDto,
  InstructorCvUploadDto,
  InstructorProfileDto,
  InstructorPublicProfileDto,
  InstructorRosterDto,
  InstructorSignupInput,
  Paginated,
  UpdateInstructorProfileInput,
} from "@skillstream/shared";
import { ulid } from "ulid";
import type { RequestUser } from "../../common/decorators/decorators";
import { PrismaService } from "../../prisma/prisma.service";
import {
  NotificationsService,
  type NotifyInput,
} from "../notifications/notifications.service";
import { CV_KEY_PREFIX, STORAGE_DRIVER } from "../storage/storage.constants";
import type { StorageDriver } from "../storage/storage.driver";
import { InstructorRepository } from "./instructor.repository";
import type { ValidatedCvFile } from "./pipes/cv-file.pipe";

const approvedNotify = (userId: string, note?: string | null): NotifyInput => ({
  userId,
  event: "INSTRUCTOR_APPLICATION_APPROVED",
  title: "Instructor application approved",
  body: note
    ? `You're approved as an instructor — you can start building courses. ${note}`
    : "You're approved as an instructor — you can start building courses.",
  href: "/instructor",
});

@Injectable()
export class InstructorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: InstructorRepository,
    private readonly notifications: NotificationsService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
  ) {}

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

    const app = await this.createApplicationRecord(user.id, dbUser.name, dbUser.email, input);
    return this.toAppDto(app);
  }

  /** Shared by `apply()` (an existing account applying) and
   *  `createSignupApplication()` (a brand-new instructor account created and
   *  applying in the same step, from the dedicated signup journey). */
  private createApplicationRecord(
    userId: string,
    name: string,
    email: string,
    input: Omit<ApplyInstructorInput, "cvKey" | "cvName" | "cvSizeLabel"> &
      Partial<Pick<ApplyInstructorInput, "cvKey" | "cvName" | "cvSizeLabel">>,
  ) {
    return this.repo.createApplication({
      userId,
      name,
      email,
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
  }

  /** Used by the dedicated instructor-signup journey (AuthService, right
   *  after the account is created) — a brand-new user can't already have a
   *  pending application, so this skips straight to creating the record. */
  async createSignupApplication(
    userId: string,
    name: string,
    email: string,
    input: InstructorSignupInput,
  ): Promise<void> {
    await this.createApplicationRecord(userId, name, email, input);
  }

  /** Used by AuthService#me so a pending/rejected applicant's `/auth/me`
   *  response reflects their status even before an InstructorProfile row
   *  exists (that row is only created on approval). */
  async latestApplicationStatus(
    userId: string,
  ): Promise<InstructorApplicationDto["status"] | null> {
    const app = await this.repo.findLatestApplicationByUser(userId);
    return app?.status ?? null;
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
    const courses = await this.repo.findPublishedCourseStatsByInstructorIds(rows.map((u) => u.id));
    const stats = new Map<string, { studentCount: number; ratingSum: number; weight: number }>();
    for (const course of courses) {
      const current = stats.get(course.instructorId) ?? { studentCount: 0, ratingSum: 0, weight: 0 };
      const weight = course.ratingWeightedCount > 0 ? course.ratingWeightedCount : course.reviewCount;
      stats.set(course.instructorId, {
        studentCount: current.studentCount + course.studentCount,
        ratingSum: current.ratingSum + course.ratingAvg * weight,
        weight: current.weight + weight,
      });
    }
    const mapped = rows.map((u) => {
      const aggregate = stats.get(u.id);
      const live = {
        studentCount: aggregate?.studentCount ?? 0,
        ratingAvg: aggregate && aggregate.weight > 0 ? aggregate.ratingSum / aggregate.weight : 0,
      };
      return {
        id: u.id,
        name: u.name,
        avatar: u.avatar,
        title: u.instructorProfile?.title ?? "",
        bio: u.instructorProfile?.bio ?? "",
        ratingAvg: live.ratingAvg,
        studentCount: live.studentCount,
        courseCount: u.instructorProfile?.courseCount ?? 0,
      };
    });
    return mapped.sort((a, b) => b.ratingAvg - a.ratingAvg);
  }
  async publicProfile(id: string): Promise<InstructorPublicProfileDto> {
    const u = await this.repo.findApprovedProfileByUserId(id);
    if (!u?.instructorProfile) throw new NotFoundException("Instructor not found");
    const p = u.instructorProfile;
    const live = await this.repo.computeInstructorStats(u.id);
    return {
      id: u.id,
      name: u.name,
      avatar: u.avatar,
      title: p.title,
      bio: p.bio,
      expertise: p.expertise,
      ratingAvg: live.ratingAvg,
      studentCount: live.studentCount,
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
   *  so a pending or rejected applicant would otherwise see
   *  `null` here and
   *  the frontend's ApprovalGate would show "not an instructor yet" instead
   *  of their actual status. */
  async myProfile(user: RequestUser): Promise<InstructorProfileDto | null> {
    const u = await this.repo.findUserWithProfile(user.id);
    if (u?.instructorProfile) {
      const p = u.instructorProfile;
      const live = await this.repo.computeInstructorStats(u.id);
      const pendingNameChange = await this.repo.findPendingNameChangeRequest(u.id);
      return {
        userId: u.id,
        name: u.name,
        email: u.email,
        avatar: u.avatar,
        title: p.title,
        bio: p.bio,
        expertise: p.expertise,
        ratingAvg: live.ratingAvg,
        studentCount: live.studentCount,
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
        pendingNameChange: pendingNameChange ? toNameChangeDto(pendingNameChange) : null,
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

  async requestNameChange(
    user: RequestUser,
    input: RequestInstructorNameChangeInput,
  ): Promise<InstructorNameChangeRequestDto> {
    const current = await this.repo.findUserWithProfile(user.id);
    if (!current?.instructorProfile || current.instructorProfile.status !== "APPROVED") {
      throw new ForbiddenException("Only approved instructors can request a name change");
    }
    const requestedName = input.requestedName.trim();
    if (requestedName === current.name) {
      throw new BadRequestException("The requested name is the same as your current name");
    }
    const pending = await this.repo.findPendingNameChangeRequest(user.id);
    if (pending) throw new BadRequestException("You already have a pending name-change request");
    const request = await this.repo.createNameChangeRequest({
      userId: user.id,
      currentName: current.name,
      requestedName,
    });
    return toNameChangeDto(request);
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
    const linkFields = {
      sampleUrl: nullableUrl(input.sampleUrl),
      linkedinUrl: nullableUrl(input.linkedinUrl),
      twitterUrl: nullableUrl(input.twitterUrl),
      youtubeUrl: nullableUrl(input.youtubeUrl),
      facebookUrl: nullableUrl(input.facebookUrl),
      otherUrl: nullableUrl(input.otherUrl),
    };

    // A PENDING applicant has no InstructorProfile row yet (that's only
    // created on approval) — fall back to updating the application itself so
    // edits made before approval aren't silently dropped.
    const current = await this.repo.findUserWithProfile(user.id);
    if (current?.instructorProfile) {
      await this.prisma.$transaction(async (tx) => {
        const profileData = {
          title: input.title,
          bio: input.bio,
          expertise: input.expertise,
          ...linkFields,
        };
        await this.repo.updateInstructorProfile(user.id, profileData, tx);

        // Keep the Admin application view synchronized with the live profile.
        const application = await this.repo.findLatestApplicationByUserWithDb(user.id, tx);
        if (application?.status === "APPROVED") {
          await this.repo.updateApplication(
            application.id,
            {
              headline: input.title,
              bio: input.bio,
              expertise: input.expertise,
              ...linkFields,
            },
            tx,
          );
        }
      });
    } else {
      const application = await this.repo.findLatestApplicationByUser(user.id);
      if (!application) throw new NotFoundException("Instructor profile not found");
      await this.repo.updateApplication(application.id, {
        headline: input.title,
        bio: input.bio,
        expertise: input.expertise,
        ...linkFields,
      });
    }
    const profile = await this.myProfile(user);
    if (!profile) throw new NotFoundException("Instructor profile not found");
    return profile;
  }

  async listNameChangeRequests(query: NameChangeRequestQuery): Promise<Paginated<InstructorNameChangeRequestDto>> {
    const where: Prisma.InstructorNameChangeRequestWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { currentName: { contains: query.q, mode: "insensitive" } },
              { requestedName: { contains: query.q, mode: "insensitive" } },
              { user: { name: { contains: query.q, mode: "insensitive" } } },
              { user: { email: { contains: query.q, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.repo.findNameChangeRequestsPage(
      where,
      query.page,
      query.pageSize,
    );
    return {
      items: rows.map(toNameChangeDto),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async approveNameChange(admin: RequestUser, id: string): Promise<InstructorNameChangeRequestDto> {
    const request = await this.repo.findNameChangeRequestById(id);
    if (!request) throw new NotFoundException("Name-change request not found");
    if (request.status !== "PENDING") throw new BadRequestException("This request has already been reviewed");
    const current = await this.repo.findUserByIdOrThrow(request.userId);
    if (current.name !== request.currentName) {
      throw new BadRequestException("The instructor name changed before this request was reviewed");
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await this.repo.updateNameChangeRequest(
        id,
        { status: "APPROVED", reviewedAt: new Date(), reviewedBy: admin.id },
        tx,
      );
      await this.repo.updateUserName(request.userId, request.requestedName, tx);
      return toNameChangeDto(updated);
    });
  }

  async rejectNameChange(id: string, note: string): Promise<InstructorNameChangeRequestDto> {
    const request = await this.repo.findNameChangeRequestById(id);
    if (!request) throw new NotFoundException("Name-change request not found");
    if (request.status !== "PENDING") throw new BadRequestException("This request has already been reviewed");
    const updated = await this.repo.updateNameChangeRequest(id, {
      status: "REJECTED",
      reviewedAt: new Date(),
      note,
    });
    return toNameChangeDto(updated);
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
        await this.notifications.notify(approvedNotify(app.userId, note), tx);
      }
      return a;
    });
    if (app.userId) {
      void this.notifications
        .notifyEmailAfterCommit(approvedNotify(app.userId, note))
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

function toNameChangeDto(
  request: Prisma.InstructorNameChangeRequestGetPayload<{
    include: { user: { select: { email: true } } };
  }>,
): InstructorNameChangeRequestDto {
  return {
    id: request.id,
    userId: request.userId,
    currentName: request.currentName,
    requestedName: request.requestedName,
    status: request.status,
    requestedAt: request.requestedAt.toISOString(),
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
    reviewedBy: request.reviewedBy,
    note: request.note,
    email: request.user.email,
  };
}

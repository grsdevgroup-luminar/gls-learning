import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InstructorApplication, InstructorStatus } from "@prisma/client";
import type {
  ApplyInstructorInput,
  InstructorApplicationDto,
  InstructorProfileDto,
  InstructorRosterDto,
  UpdateInstructorProfileInput,
} from "@skillstream/shared";
import type { RequestUser } from "../../common/decorators/decorators";
import { PrismaService } from "../../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { InstructorRepository } from "./instructor.repository";

@Injectable()
export class InstructorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: InstructorRepository,
    private readonly email: EmailService,
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

  private toAppDto(a: InstructorApplication): InstructorApplicationDto {
    return {
      id: a.id,
      name: a.name,
      email: a.email,
      expertise: a.expertise,
      headline: a.headline,
      bio: a.bio,
      sampleUrl: a.sampleUrl,
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

    const app = await this.repo.createApplication({
      userId: user.id,
      name: dbUser.name,
      email: dbUser.email,
      expertise: input.expertise,
      headline: input.headline,
      bio: input.bio,
      sampleUrl: input.sampleUrl,
      status: "PENDING",
    });
    return this.toAppDto(app);
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

  async myProfile(user: RequestUser): Promise<InstructorProfileDto | null> {
    const u = await this.repo.findUserWithProfile(user.id);
    if (!u || !u.instructorProfile) return null;
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
    };
  }

  async updateProfile(
    user: RequestUser,
    input: UpdateInstructorProfileInput,
  ): Promise<InstructorProfileDto> {
    if (input.avatar !== undefined)
      await this.repo.updateUserAvatar(user.id, input.avatar);
    await this.repo.updateInstructorProfile(user.id, {
      title: input.title,
      bio: input.bio,
      expertise: input.expertise,
    });
    const profile = await this.myProfile(user);
    if (!profile) throw new NotFoundException("Instructor profile not found");
    return profile;
  }

  // ── admin ──────────────────────────────────────────────────────────────
  async listApplications(
    status?: InstructorStatus,
  ): Promise<InstructorApplicationDto[]> {
    const rows = await this.repo.findManyApplications(status);
    return rows.map((a) => this.toAppDto(a));
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
        await this.repo.upsertInstructorProfile(
          app.userId,
          { status: "APPROVED", title: app.headline, bio: app.bio, expertise: app.expertise },
          {
            userId: app.userId,
            status: "APPROVED",
            title: app.headline,
            bio: app.bio,
            expertise: app.expertise,
          },
          tx,
        );
      }
      return a;
    });
    this.notifyDecision(updated, true, note);
    return this.toAppDto(updated);
  }

  async reject(appId: string, note?: string): Promise<InstructorApplicationDto> {
    const app = await this.repo.updateApplication(appId, {
      status: "REJECTED",
      reviewedAt: new Date(),
      note,
    });
    this.notifyDecision(app, false, note);
    return this.toAppDto(app);
  }
}

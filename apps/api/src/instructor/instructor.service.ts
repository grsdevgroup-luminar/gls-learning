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
import type { RequestUser } from "../common/decorators";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class InstructorService {
  constructor(private readonly prisma: PrismaService) {}

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
    const dbUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    const pending = await this.prisma.instructorApplication.findFirst({
      where: { userId: user.id, status: "PENDING" },
    });
    if (pending) throw new BadRequestException("You already have a pending application");

    const app = await this.prisma.instructorApplication.create({
      data: {
        userId: user.id,
        name: dbUser.name,
        email: dbUser.email,
        expertise: input.expertise,
        headline: input.headline,
        bio: input.bio,
        sampleUrl: input.sampleUrl,
        status: "PENDING",
      },
    });
    return this.toAppDto(app);
  }

  /** Approved instructors, best-rated first — powers the public roster. */
  async roster(): Promise<InstructorRosterDto[]> {
    const rows = await this.prisma.user.findMany({
      where: { instructorProfile: { status: InstructorStatus.APPROVED } },
      include: { instructorProfile: true },
      orderBy: { instructorProfile: { ratingAvg: "desc" } },
    });
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
    const u = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: { instructorProfile: true },
    });
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
      await this.prisma.user.update({
        where: { id: user.id },
        data: { avatar: input.avatar },
      });
    await this.prisma.instructorProfile.update({
      where: { userId: user.id },
      data: { title: input.title, bio: input.bio, expertise: input.expertise },
    });
    const profile = await this.myProfile(user);
    if (!profile) throw new NotFoundException("Instructor profile not found");
    return profile;
  }

  // ── admin ──────────────────────────────────────────────────────────────
  async listApplications(
    status?: InstructorStatus,
  ): Promise<InstructorApplicationDto[]> {
    const rows = await this.prisma.instructorApplication.findMany({
      where: status ? { status } : undefined,
      orderBy: { appliedAt: "desc" },
    });
    return rows.map((a) => this.toAppDto(a));
  }

  async approve(appId: string, note?: string): Promise<InstructorApplicationDto> {
    const app = await this.prisma.instructorApplication.findUnique({
      where: { id: appId },
    });
    if (!app) throw new NotFoundException("Application not found");

    const updated = await this.prisma.$transaction(async (tx) => {
      const a = await tx.instructorApplication.update({
        where: { id: appId },
        data: { status: "APPROVED", reviewedAt: new Date(), note },
      });
      if (app.userId) {
        await tx.user.update({
          where: { id: app.userId },
          data: { role: "INSTRUCTOR" },
        });
        await tx.instructorProfile.upsert({
          where: { userId: app.userId },
          update: { status: "APPROVED", title: app.headline, bio: app.bio, expertise: app.expertise },
          create: {
            userId: app.userId,
            status: "APPROVED",
            title: app.headline,
            bio: app.bio,
            expertise: app.expertise,
          },
        });
      }
      return a;
    });
    return this.toAppDto(updated);
  }

  async reject(appId: string, note?: string): Promise<InstructorApplicationDto> {
    const app = await this.prisma.instructorApplication.update({
      where: { id: appId },
      data: { status: "REJECTED", reviewedAt: new Date(), note },
    });
    return this.toAppDto(app);
  }
}

import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class CertificatesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findBySerial(serial: string) {
    return this.prisma.certificate.findUnique({
      where: { serial },
      select: {
        id: true,
        serial: true,
        learnerName: true,
        courseNumber: true,
        issuedAt: true,
        enrollment: {
          select: {
            userId: true,
            enrolledAt: true,
            completedAt: true,
            course: { select: { courseNumber: true, title: true, slug: true, isoStandard: true } },
          },
        },
      },
    });
  }

  findByIdForUser(id: string, userId: string) {
    return this.prisma.certificate.findFirst({
      where: {
        id,
        enrollment: { userId },
      },
      select: {
        id: true,
        serial: true,
        learnerName: true,
        courseNumber: true,
        issuedAt: true,
        enrollment: {
          select: {
            userId: true,
            enrolledAt: true,
            completedAt: true,
            course: { select: { courseNumber: true, title: true, slug: true, isoStandard: true } },
          },
        },
      },
    });
  }
}

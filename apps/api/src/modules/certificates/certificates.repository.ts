import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class CertificatesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findBySerial(serial: string) {
    return this.prisma.certificate.findUnique({
      where: { serial },
      select: {
        serial: true,
        learnerName: true,
        issuedAt: true,
        enrollment: {
          select: {
            course: { select: { title: true, slug: true } },
          },
        },
      },
    });
  }
}

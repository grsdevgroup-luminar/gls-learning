import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { CertificateVerificationDto } from "@skillstream/shared";
import { CertificatesRepository } from "./certificates.repository";
import { certificatePdf } from "../../common/utils/pdf";
import { apiBaseUrl, certificateVerifyUrl } from "../../common/utils/urls";
import type { Env } from "../../config/env";

@Injectable()
export class CertificatesService {
  constructor(
    private readonly repo: CertificatesRepository,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Certificates are addressed by their serial (a random UUID), which is the
   * only credential a verifier has. Unguessable by construction, so the lookup
   * is public — but it exposes a learner's name, so nothing else about the
   * account (email, id, other enrolments) is ever returned.
   */
  private async findBySerial(serial: string) {
    const cert = await this.repo.findBySerial(serial);
    if (!cert) throw new NotFoundException("Certificate not found");
    return cert;
  }

  async verify(serial: string): Promise<CertificateVerificationDto> {
    const cert = await this.findBySerial(serial);
    const verificationUrl = certificateVerifyUrl(
      this.config.get("FRONTEND_URL", { infer: true }),
      cert.serial,
    );
    return {
      valid: true,
      serial: cert.serial,
      learnerName: cert.learnerName,
      courseTitle: cert.enrollment.course.title,
      courseSlug: cert.enrollment.course.slug,
      uniqueId: cert.serial,
      courseNumber: cert.courseNumber,
      courseStartDate: cert.enrollment.enrolledAt.toISOString(),
      courseEndDate: (cert.enrollment.completedAt ?? cert.issuedAt).toISOString(),
      verificationUrl,
      isoStandard: cert.enrollment.course.isoStandard,
      issuedAt: cert.issuedAt.toISOString(),
    };
  }

  async pdf(serial: string): Promise<Buffer> {
    const cert = await this.findBySerial(serial);
    return certificatePdf({
      learnerName: cert.learnerName,
      courseTitle: cert.enrollment.course.title,
      issuedAt: cert.issuedAt,
      serial: cert.serial,
      verifyUrl: certificateVerifyUrl(
        this.config.get("FRONTEND_URL", { infer: true }),
        cert.serial,
      ),
    });
  }

  /** Where `CertificateDto.pdfUrl` points when the row has no stored file. */
  pdfUrlFor(serial: string): string {
    return `${apiBaseUrl(this.config)}/certificates/${serial}/pdf`;
  }
}

import { Module } from "@nestjs/common";
import { CertificatesController } from "./certificates.controller";
import { CertificatesService } from "./certificates.service";
import { CertificatesRepository } from "./certificates.repository";
import { CertificatePdfService } from "./certificate-pdf.service";

@Module({
  controllers: [CertificatesController],
  providers: [CertificatesService, CertificatesRepository, CertificatePdfService],
  exports: [CertificatesService],
})
export class CertificatesModule {}

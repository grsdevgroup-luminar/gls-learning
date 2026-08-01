import {
  Controller,
  Get,
  Header,
  Param,
  Res,
  StreamableFile,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { Public } from "../common/decorators";
import { CertificatesService } from "./certificates.service";

@ApiTags("certificates")
@Controller("certificates")
export class CertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  /**
   * Public verification: an employer pasting a serial gets back who earned it,
   * for what, and when — nothing else about the account. Rate-limited well
   * below the default so the endpoint can't be used to enumerate serials.
   */
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get(":serial")
  @ApiOperation({
    summary: "Verify a certificate by serial",
    description:
      "Public. Returns the learner name, course and issue date for a valid serial; 404 otherwise.",
  })
  @ApiOkResponse({
    schema: {
      type: "object",
      properties: {
        valid: { type: "boolean", example: true },
        serial: { type: "string", example: "CERT-9F2C71A0B4D3" },
        learnerName: { type: "string", example: "Ada Lovelace" },
        courseTitle: { type: "string", example: "Advanced TypeScript" },
        courseSlug: { type: "string", example: "advanced-typescript" },
        issuedAt: { type: "string", format: "date-time" },
      },
    },
  })
  verify(@Param("serial") serial: string) {
    return this.certificates.verify(serial);
  }

  /** The printable certificate. Public for the same reason as verification. */
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get(":serial/pdf")
  @Header("Content-Type", "application/pdf")
  @Header("Cache-Control", "private, max-age=300")
  @ApiProduces("application/pdf")
  @ApiOperation({ summary: "Download a certificate as a PDF" })
  async pdf(
    @Param("serial") serial: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const pdf = await this.certificates.pdf(serial);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="skillstream-certificate-${serial}.pdf"`,
    );
    return new StreamableFile(pdf);
  }
}

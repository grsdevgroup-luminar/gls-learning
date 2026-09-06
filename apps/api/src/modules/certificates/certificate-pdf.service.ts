import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { chromium } from "playwright";
import type { Env } from "../../config/env";
import { CertificatesRepository } from "./certificates.repository";

/** Generates the certificate on demand; generated PDFs are not persisted. */
@Injectable()
export class CertificatePdfService {
  constructor(
    private readonly repo: CertificatesRepository,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async generateForUser(certificateId: string, userId: string): Promise<Buffer> {
    const certificate = await this.repo.findByIdForUser(certificateId, userId);
    if (!certificate) throw new NotFoundException("Certificate not found");

    const frontendUrl = this.config.get("FRONTEND_URL", { infer: true }).replace(/\/$/, "");
    const printUrl = `${frontendUrl}/certificates/${encodeURIComponent(certificate.serial)}/print`;
    const executablePath = this.config.get("PLAYWRIGHT_EXECUTABLE_PATH", { infer: true });
    const browser = await chromium.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
    });

    try {
      const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
      await page.goto(printUrl, { waitUntil: "networkidle" });
      await page.locator(".certificate-template").waitFor({ state: "visible" });
      await page.evaluate("document.fonts.ready");
      await page.emulateMedia({ media: "print" });

      const pdf = await page.pdf({
        format: "A4",
        landscape: false,
        printBackground: true,
        displayHeaderFooter: false,
        preferCSSPageSize: true,
        margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
        pageRanges: "1",
      });

      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }
}

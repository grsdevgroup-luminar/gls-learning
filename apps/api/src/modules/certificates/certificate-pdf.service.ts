import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { chromium, type Browser } from "playwright";
import type { Env } from "../../config/env";

@Injectable()
export class CertificatePdfService implements OnModuleDestroy {
  private readonly logger = new Logger(CertificatePdfService.name);
  private browserPromise: Promise<Browser> | null = null;

  constructor(private readonly config: ConfigService<Env, true>) {}

  async render(serial: string): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage({ viewport: { width: 1241, height: 1754 } });
    try {
      const frontendUrl = this.config.get("FRONTEND_URL", { infer: true });
      await page.goto(
        `${frontendUrl}/certificates/${encodeURIComponent(serial)}/print`,
        { waitUntil: "networkidle" },
      );
      await page.locator(".certificate-template").waitFor();
      await page.evaluate(() => (globalThis as unknown as { document: { fonts: { ready: Promise<unknown> } } }).document.fonts.ready);
      await page.emulateMedia({ media: "print" });
      return Buffer.from(
        await page.pdf({
          format: "A4",
          printBackground: true,
          displayHeaderFooter: false,
          preferCSSPageSize: true,
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
          pageRanges: "1",
        }),
      );
    } finally {
      await page.close();
    }
  }

  async onModuleDestroy() {
    if (this.browserPromise) {
      const browser = await this.browserPromise;
      await browser.close();
      this.browserPromise = null;
    }
  }

  private getBrowser(): Promise<Browser> {
    this.browserPromise ??= chromium.launch({
      headless: true,
      executablePath: this.config.get("PLAYWRIGHT_EXECUTABLE_PATH", { infer: true }) || undefined,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    }).catch((error) => {
      this.browserPromise = null;
      this.logger.error("Could not launch Chromium for certificate PDF", error);
      throw error;
    });
    return this.browserPromise;
  }
}
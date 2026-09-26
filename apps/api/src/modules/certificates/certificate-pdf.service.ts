import {
  Injectable,
  Logger,
  OnModuleDestroy,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { chromium, type Browser } from "playwright";
import type { Env } from "../../config/env";

const MAX_PENDING_RENDERS = 8;

interface RenderTask {
  serial: string;
  resolve: (pdf: Buffer) => void;
  reject: (error: unknown) => void;
}

@Injectable()
export class CertificatePdfService implements OnModuleDestroy {
  private readonly logger = new Logger(CertificatePdfService.name);
  private browserPromise: Promise<Browser> | null = null;
  private readonly pendingRenders: RenderTask[] = [];
  private activeRenders = 0;
  private shuttingDown = false;

  constructor(private readonly config: ConfigService<Env, true>) {}

  async render(serial: string): Promise<Buffer> {
    if (this.shuttingDown) {
      throw new HttpException(
        "Certificate PDF generation is shutting down",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (this.pendingRenders.length >= MAX_PENDING_RENDERS) {
      throw new HttpException(
        "Certificate PDF generation is busy. Please try again shortly.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return new Promise<Buffer>((resolve, reject) => {
      this.pendingRenders.push({ serial, resolve, reject });
      this.drainRenderQueue();
    });
  }
  private async renderNow(serial: string): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage({
      viewport: { width: 1241, height: 1754 },
    });
    const frontendUrl = this.config
      .get("FRONTEND_URL", { infer: true })
      .replace(/\/+$/, "");
    const printUrl =
      frontendUrl + "/certificates/" + encodeURIComponent(serial) + "/print";

    try {
      const response = await page.goto(printUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });

      if (!response?.ok()) {
        throw new Error(
          "Certificate print page returned " +
            (response?.status() ?? "no response") +
            " for " +
            printUrl,
        );
      }

      await page.locator(".certificate-template").waitFor({
        state: "visible",
        timeout: 30_000,
      });
      await page.evaluate(
        () =>
          (
            globalThis as unknown as {
              document: { fonts: { ready: Promise<unknown> } };
            }
          ).document.fonts.ready,
      );
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
    } catch (error) {
      this.logger.error(
        "Failed to render certificate " + serial + " from " + printUrl,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    } finally {
      await page.close();
    }
  }

  async onModuleDestroy() {
    this.shuttingDown = true;
    const shutdownError = new HttpException(
      "Certificate PDF generation is shutting down",
      HttpStatus.TOO_MANY_REQUESTS,
    );
    for (const task of this.pendingRenders.splice(0)) {
      task.reject(shutdownError);
    }

    if (this.browserPromise) {
      const browser = await this.browserPromise;
      await browser.close();
      this.browserPromise = null;
    }
  }

  private drainRenderQueue(): void {
    if (this.activeRenders > 0 || this.shuttingDown) {
      return;
    }

    const task = this.pendingRenders.shift();
    if (!task) {
      return;
    }

    this.activeRenders += 1;
    void this.renderNow(task.serial)
      .then(task.resolve, task.reject)
      .finally(() => {
        this.activeRenders -= 1;
        this.drainRenderQueue();
      });
  }
  private getBrowser(): Promise<Browser> {
    const executablePath = this.config.get("PLAYWRIGHT_EXECUTABLE_PATH", {
      infer: true,
    });
    this.browserPromise ??= chromium
      .launch({
        headless: true,
        ...(executablePath
          ? { executablePath }
          : { channel: "chromium" as const }),
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      })
      .catch((error) => {
        this.browserPromise = null;
        this.logger.error(
          "Could not launch Chromium for certificate PDF",
          error,
        );
        throw error;
      });
    return this.browserPromise;
  }
}

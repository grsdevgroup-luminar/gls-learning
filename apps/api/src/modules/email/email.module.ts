import { Global, Logger, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../config/env";
import { AdminAlertsRepository } from "./admin-alerts.repository";
import { AdminAlertsService } from "./admin-alerts.service";
import { EmailService } from "./email.service";
import { SmsService } from "./sms.service";
import {
  EMAIL_PROVIDER,
  type EmailProvider,
} from "./providers/email-provider";
import { LogProvider } from "./providers/log.provider";
import { ResendProvider } from "./providers/resend.provider";
import { SmtpProvider } from "./providers/smtp.provider";

/**
 * Provider selection lives here so the rest of the codebase depends only on
 * the `EmailProvider` interface (via `EMAIL_PROVIDER`) or the higher-level
 * `EmailService`. Adding a new transport = drop a sibling adapter in
 * `./providers/` and extend this factory + the `EMAIL_DRIVER` enum in env.ts.
 */
@Global()
@Module({
  providers: [
    {
      provide: EMAIL_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): EmailProvider => {
        const driver = config.get("EMAIL_DRIVER", { infer: true });
        const logger = new Logger("EmailModule");
        switch (driver) {
          case "resend":
            logger.log("Email transport: Resend");
            return new ResendProvider(config);
          case "smtp":
            logger.log("Email transport: SMTP (Mailpit/local relay)");
            return new SmtpProvider(config);
          case "log":
          default:
            logger.warn(
              "Email transport: log (no delivery — emails will be logged)",
            );
            return new LogProvider();
        }
      },
    },
    EmailService,
    AdminAlertsService,
    AdminAlertsRepository,
    SmsService,
  ],
  exports: [EMAIL_PROVIDER, EmailService, AdminAlertsService, SmsService],
})
export class EmailModule {}

import { Global, Module } from "@nestjs/common";
import { AdminAlertsRepository } from "./admin-alerts.repository";
import { AdminAlertsService } from "./admin-alerts.service";
import { EmailService } from "./email.service";
import { SmsService } from "./sms.service";

@Global()
@Module({
  providers: [EmailService, AdminAlertsService, AdminAlertsRepository, SmsService],
  exports: [EmailService, AdminAlertsService, SmsService],
})
export class EmailModule {}

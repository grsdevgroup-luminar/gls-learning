import { Global, Module } from "@nestjs/common";
import { AdminAlertsService } from "./admin-alerts.service";
import { EmailService } from "./email.service";
import { SmsService } from "./sms.service";

@Global()
@Module({
  providers: [EmailService, AdminAlertsService, SmsService],
  exports: [EmailService, AdminAlertsService, SmsService],
})
export class EmailModule {}

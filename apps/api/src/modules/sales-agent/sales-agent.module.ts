import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { SalesAgentController } from "./sales-agent.controller";
import { SalesAgentService } from "./sales-agent.service";
import { SalesAgentRepository } from "./sales-agent.repository";

@Module({
  imports: [NotificationsModule],
  controllers: [SalesAgentController],
  providers: [SalesAgentService, SalesAgentRepository],
  exports: [SalesAgentService],
})
export class SalesAgentModule {}

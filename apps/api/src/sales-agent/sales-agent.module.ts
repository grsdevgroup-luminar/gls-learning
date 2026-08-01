import { Module } from "@nestjs/common";
import { SalesAgentController } from "./sales-agent.controller";
import { SalesAgentService } from "./sales-agent.service";
import { SalesAgentRepository } from "./sales-agent.repository";

@Module({
  controllers: [SalesAgentController],
  providers: [SalesAgentService, SalesAgentRepository],
  exports: [SalesAgentService],
})
export class SalesAgentModule {}

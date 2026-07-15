import { Module } from "@nestjs/common";
import { SalesAgentController } from "./sales-agent.controller";
import { SalesAgentService } from "./sales-agent.service";

@Module({
  controllers: [SalesAgentController],
  providers: [SalesAgentService],
  exports: [SalesAgentService],
})
export class SalesAgentModule {}

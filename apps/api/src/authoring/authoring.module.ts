import { Module } from "@nestjs/common";
import { AuthoringController } from "./authoring.controller";
import { AuthoringService } from "./authoring.service";
import { AuthoringRepository } from "./authoring.repository";

@Module({
  controllers: [AuthoringController],
  providers: [AuthoringService, AuthoringRepository],
  exports: [AuthoringService],
})
export class AuthoringModule {}

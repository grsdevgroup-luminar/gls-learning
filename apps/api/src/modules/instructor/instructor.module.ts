import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { InstructorController } from "./instructor.controller";
import { InstructorService } from "./instructor.service";
import { InstructorRepository } from "./instructor.repository";

@Module({
  imports: [NotificationsModule],
  controllers: [InstructorController],
  providers: [InstructorService, InstructorRepository],
})
export class InstructorModule {}

import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { StorageModule } from "../storage/storage.module";
import { InstructorController } from "./instructor.controller";
import { InstructorService } from "./instructor.service";
import { InstructorRepository } from "./instructor.repository";

@Module({
  imports: [NotificationsModule, StorageModule],
  controllers: [InstructorController],
  providers: [InstructorService, InstructorRepository],
})
export class InstructorModule {}

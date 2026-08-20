import { Module } from "@nestjs/common";
import { CatalogController } from "./catalog.controller";
import { CoursesService } from "./courses.service";
import { CoursesRepository } from "./courses.repository";
import { EnrollmentModule } from "../enrollment/enrollment.module";
import { StorageModule } from "../storage/storage.module";

@Module({
  imports: [EnrollmentModule, StorageModule],
  controllers: [CatalogController],
  providers: [CoursesService, CoursesRepository],
  exports: [CoursesService],
})
export class CoursesModule {}

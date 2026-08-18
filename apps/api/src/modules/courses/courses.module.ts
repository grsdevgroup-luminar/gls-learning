import { Module } from "@nestjs/common";
import { CatalogController } from "./catalog.controller";
import { CoursesService } from "./courses.service";
import { CoursesRepository } from "./courses.repository";
import { EnrollmentModule } from "../enrollment/enrollment.module";

@Module({
  imports: [EnrollmentModule],
  controllers: [CatalogController],
  providers: [CoursesService, CoursesRepository],
  exports: [CoursesService],
})
export class CoursesModule {}

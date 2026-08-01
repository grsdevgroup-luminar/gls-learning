import { Module } from "@nestjs/common";
import { CatalogController } from "./catalog.controller";
import { CoursesService } from "./courses.service";
import { CoursesRepository } from "./courses.repository";

@Module({
  controllers: [CatalogController],
  providers: [CoursesService, CoursesRepository],
  exports: [CoursesService],
})
export class CoursesModule {}

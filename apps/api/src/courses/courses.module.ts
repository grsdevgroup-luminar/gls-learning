import { Module } from "@nestjs/common";
import { CatalogController } from "./catalog.controller";
import { CoursesService } from "./courses.service";

@Module({
  controllers: [CatalogController],
  providers: [CoursesService],
  exports: [CoursesService],
})
export class CoursesModule {}

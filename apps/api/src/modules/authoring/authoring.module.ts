import { Module } from "@nestjs/common";
import { AuthoringController } from "./authoring.controller";
import { AuthoringService } from "./authoring.service";
import { AuthoringRepository } from "./authoring.repository";
import { LessonResourceController } from "./lesson-resource.controller";
import { LessonResourceService } from "./lesson-resource.service";
import { ResourceFilePipe } from "./pipes/resource-file.pipe";
import { StorageModule } from "../storage/storage.module";
import { MediaModule } from "../media/media.module";
import { CategoriesModule } from "../categories/categories.module";

@Module({
  imports: [StorageModule, MediaModule, CategoriesModule],
  controllers: [AuthoringController, LessonResourceController],
  providers: [
    AuthoringService,
    AuthoringRepository,
    LessonResourceService,
    ResourceFilePipe,
  ],
  exports: [AuthoringService, AuthoringRepository],
})
export class AuthoringModule {}

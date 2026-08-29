import { Module } from "@nestjs/common";
import { NotificationPrefsController } from "./notification-prefs.controller";
import { LearningPreferencesController } from "./learning-preferences.controller";
import { UsersService } from "./users.service";
import { UsersRepository } from "./users.repository";
import { CategoriesModule } from "../categories/categories.module";

@Module({
  imports: [CategoriesModule],
  controllers: [NotificationPrefsController, LearningPreferencesController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService],
})
export class UsersModule {}

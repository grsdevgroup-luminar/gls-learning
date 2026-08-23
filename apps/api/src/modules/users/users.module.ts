import { Module } from "@nestjs/common";
import { NotificationPrefsController } from "./notification-prefs.controller";
import { LearningPreferencesController } from "./learning-preferences.controller";
import { UsersService } from "./users.service";
import { UsersRepository } from "./users.repository";

@Module({
  controllers: [NotificationPrefsController, LearningPreferencesController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService],
})
export class UsersModule {}

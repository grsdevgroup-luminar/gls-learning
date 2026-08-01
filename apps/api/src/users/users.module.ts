import { Module } from "@nestjs/common";
import { NotificationPrefsController } from "./notification-prefs.controller";
import { UsersService } from "./users.service";
import { UsersRepository } from "./users.repository";

@Module({
  controllers: [NotificationPrefsController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService],
})
export class UsersModule {}

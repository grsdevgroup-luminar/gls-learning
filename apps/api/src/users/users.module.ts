import { Module } from "@nestjs/common";
import { NotificationPrefsController } from "./notification-prefs.controller";
import { UsersService } from "./users.service";

@Module({
  controllers: [NotificationPrefsController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}

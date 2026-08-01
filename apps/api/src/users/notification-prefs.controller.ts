import { Controller, Get, Patch } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  updateNotificationPreferencesSchema,
  type UpdateNotificationPreferencesInput,
} from "@skillstream/shared";
import { CurrentUser, type RequestUser } from "../common/decorators";
import { ZodBody } from "../common/swagger";
import { UsersService } from "./users.service";

@ApiTags("notifications")
@ApiBearerAuth()
@Controller("me/notification-preferences")
export class NotificationPrefsController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({
    summary: "Which reminder emails/SMS the caller has opted into",
    description:
      "Always fully populated: triggers the user has never touched come back at their defaults (email on, SMS off).",
  })
  getPreferences(@CurrentUser() user: RequestUser) {
    return this.users.notificationPrefs(user.id);
  }

  @Patch()
  @ApiOperation({
    summary: "Update reminder preferences",
    description:
      "Sparse merge — only the triggers/channels present in the body change. Enforced at delivery time, so an opt-out silently drops matching reminders.",
  })
  updatePreferences(
    @CurrentUser() user: RequestUser,
    @ZodBody(updateNotificationPreferencesSchema)
    body: UpdateNotificationPreferencesInput,
  ) {
    return this.users.updateNotificationPrefs(user.id, body);
  }
}

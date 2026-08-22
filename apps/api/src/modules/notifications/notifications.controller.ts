import { Controller, Get, Param, Patch } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  paginationQuerySchema,
  type PaginationQuery,
} from "@skillstream/shared";
import { CurrentUser, type RequestUser } from "../../common/decorators/decorators";
import { ZodQuery } from "../../common/utils/swagger";
import { NotificationsService } from "./notifications.service";

@ApiTags("notifications")
@ApiBearerAuth()
@Controller("me/notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: "Paginated notification feed for the caller, newest first" })
  list(
    @CurrentUser() user: RequestUser,
    @ZodQuery(paginationQuerySchema) query: PaginationQuery,
  ) {
    return this.notifications.listForUser(user.id, query);
  }

  @Get("unread-count")
  @ApiOperation({ summary: "Unread count for the bell badge — cheap, polled every 20-30s" })
  unreadCount(@CurrentUser() user: RequestUser) {
    return this.notifications.unreadCount(user.id);
  }

  @Patch(":id/read")
  @ApiOperation({ summary: "Mark one notification read" })
  markRead(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.notifications.markRead(user.id, id);
  }

  @Patch("read-all")
  @ApiOperation({ summary: "Mark every notification read" })
  markAllRead(@CurrentUser() user: RequestUser) {
    return this.notifications.markAllRead(user.id);
  }
}

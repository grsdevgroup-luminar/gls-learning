import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ReviewStatus } from "@prisma/client";
import {
  reviewStatusSchema,
  upsertCouponSchema,
  updateUserStatusSchema,
  upsertAutomationRuleSchema,
  type ReviewStatusInput,
  type UpsertCouponInput,
  type UpdateUserStatusInput,
  type UpsertAutomationRuleInput,
} from "@skillstream/shared";
import { Roles } from "../common/decorators";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { AdminService } from "./admin.service";
import { ReviewsService } from "../reviews/reviews.service";

@ApiTags("admin")
@ApiBearerAuth()
@Roles("ADMIN")
@Controller("admin")
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly reviews: ReviewsService,
  ) {}

  @Get("overview")
  overview() {
    return this.admin.overview();
  }

  @Get("students")
  students() {
    return this.admin.students();
  }

  @Get("courses")
  courses() {
    return this.admin.courses();
  }

  @Get("orders")
  orders() {
    return this.admin.orders();
  }

  @Post("orders/:id/refund")
  refundOrder(@Param("id") id: string) {
    return this.admin.refundOrder(id);
  }

  // users
  @Patch("users/:id/status")
  updateUserStatus(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateUserStatusSchema)) body: UpdateUserStatusInput,
  ) {
    return this.admin.updateUserStatus(id, body);
  }

  @Delete("users/:id")
  deleteUser(@Param("id") id: string) {
    return this.admin.deleteUser(id);
  }

  // coupons
  @Get("coupons")
  listCoupons() {
    return this.admin.listCoupons();
  }

  @Post("coupons")
  upsertCoupon(
    @Body(new ZodValidationPipe(upsertCouponSchema)) body: UpsertCouponInput,
  ) {
    return this.admin.upsertCoupon(body);
  }

  @Delete("coupons/:code")
  deleteCoupon(@Param("code") code: string) {
    return this.admin.deleteCoupon(code);
  }

  // reviews moderation
  @Get("reviews")
  reviewsList(@Query("status") status?: ReviewStatus) {
    return this.reviews.adminList(status);
  }

  @Patch("reviews/:id/status")
  setReviewStatus(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(reviewStatusSchema)) body: ReviewStatusInput,
  ) {
    return this.reviews.setStatus(id, body);
  }

  // marketing / automation
  @Get("automation-rules")
  automationRules() {
    return this.admin.listAutomationRules();
  }

  @Post("automation-rules")
  createAutomationRule(
    @Body(new ZodValidationPipe(upsertAutomationRuleSchema)) body: UpsertAutomationRuleInput,
  ) {
    return this.admin.upsertAutomationRule(undefined, body);
  }

  @Patch("automation-rules/:id")
  updateAutomationRule(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(upsertAutomationRuleSchema)) body: UpsertAutomationRuleInput,
  ) {
    return this.admin.upsertAutomationRule(id, body);
  }

  @Delete("automation-rules/:id")
  deleteAutomationRule(@Param("id") id: string) {
    return this.admin.deleteAutomationRule(id);
  }

  @Get("reminder-logs")
  reminderLogs() {
    return this.admin.listReminderLogs();
  }
}

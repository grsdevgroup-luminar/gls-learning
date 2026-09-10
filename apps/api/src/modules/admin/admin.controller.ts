import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  adminCourseQuerySchema,
  adminOrderQuerySchema,
  adminReviewQuerySchema,
  patchCouponSchema,
  refundOrderSchema,
  reviewStatusSchema,
  searchQuerySchema,
  updatePlatformSettingsSchema,
  upsertCouponSchema,
  updateUserStatusSchema,
  upsertAutomationRuleSchema,
  upsertEmailTemplateSchema,
  previewEmailTemplateSchema,
  type AdminCourseQuery,
  type AdminOrderQuery,
  type AdminReviewQuery,
  type PatchCouponInput,
  type RefundOrderInput,
  type ReviewStatusInput,
  type SearchQuery,
  type UpdatePlatformSettingsInput,
  type UpsertCouponInput,
  type UpdateUserStatusInput,
  type UpsertAutomationRuleInput,
  type UpsertEmailTemplateInput,
  type PreviewEmailTemplateInput,
} from "@skillstream/shared";
import { CurrentUser, Roles, type RequestUser } from "../../common/decorators/decorators";
import { ZodBody, ZodQuery } from "../../common/utils/swagger";
import { AdminService } from "./admin.service";
import { EmailService } from "../email/email.service";
import { EmailTemplatesService } from "../email/email-templates.service";
import { ReviewsService } from "../reviews/reviews.service";

@ApiTags("admin")
@ApiBearerAuth()
@Roles("ADMIN")
@Controller("admin")
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly reviews: ReviewsService,
    private readonly emailTemplates: EmailTemplatesService,
    private readonly email: EmailService,
  ) {}

  @Get("overview")
  overview() {
    return this.admin.overview();
  }

  @Get("analytics")
  analytics() {
    return this.admin.analytics();
  }

  @Get("students")
  students(@ZodQuery(searchQuerySchema) query: SearchQuery) {
    return this.admin.students(query);
  }

  @Get("students/stats")
  studentStats() {
    return this.admin.studentStats();
  }

  @Get("students/:id/profile")
  studentProfile(@Param("id") id: string) {
    return this.admin.studentProfile(id);
  }

  @Get("courses")
  courses(@ZodQuery(adminCourseQuerySchema) query: AdminCourseQuery) {
    return this.admin.courses(query);
  }

  @Get("courses/stats")
  courseStats() {
    return this.admin.courseStats();
  }

  @Get("orders")
  orders(@ZodQuery(adminOrderQuerySchema) query: AdminOrderQuery) {
    return this.admin.orders(query);
  }

  @Get("orders/stats")
  orderStats() {
    return this.admin.orderStats();
  }

  @Post("orders/:id/refund")
  refundOrder(
    @Param("id") id: string,
    @ZodBody(refundOrderSchema) body: RefundOrderInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.admin.refundOrder(id, body, user.id);
  }

  // users
  @Patch("users/:id/status")
  updateUserStatus(
    @Param("id") id: string,
    @ZodBody(updateUserStatusSchema) body: UpdateUserStatusInput,
  ) {
    return this.admin.updateUserStatus(id, body);
  }

  @Delete("users/:id")
  deleteUser(@Param("id") id: string) {
    return this.admin.deleteUser(id);
  }

  // platform settings
  @Get("settings")
  settings() {
    return this.admin.settings();
  }

  @Patch("settings")
  updateSettings(
    @ZodBody(updatePlatformSettingsSchema) body: UpdatePlatformSettingsInput,
  ) {
    return this.admin.updateSettings(body);
  }

  // coupons
  @Get("coupons")
  listCoupons(@ZodQuery(searchQuerySchema) query: SearchQuery) {
    return this.admin.listCoupons(query);
  }

  @Post("coupons")
  upsertCoupon(
    @ZodBody(upsertCouponSchema) body: UpsertCouponInput,
  ) {
    return this.admin.upsertCoupon(body);
  }

  @Patch("coupons/:code")
  patchCoupon(
    @Param("code") code: string,
    @ZodBody(patchCouponSchema) body: PatchCouponInput,
  ) {
    return this.admin.patchCoupon(code, body);
  }

  @Delete("coupons/:code")
  deleteCoupon(@Param("code") code: string) {
    return this.admin.deleteCoupon(code);
  }

  // reviews moderation
  @Get("reviews/stats")
  reviewsStats() {
    return this.reviews.adminStats();
  }

  @Get("reviews/courses")
  reviewCourses() {
    return this.reviews.adminCourses();
  }

  @Get("reviews")
  reviewsList(@ZodQuery(adminReviewQuerySchema) query: AdminReviewQuery) {
    return this.reviews.adminList(query);
  }

  @Patch("reviews/:id/status")
  setReviewStatus(
    @Param("id") id: string,
    @ZodBody(reviewStatusSchema) body: ReviewStatusInput,
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
    @ZodBody(upsertAutomationRuleSchema) body: UpsertAutomationRuleInput,
  ) {
    return this.admin.upsertAutomationRule(undefined, body);
  }

  @Patch("automation-rules/:id")
  updateAutomationRule(
    @Param("id") id: string,
    @ZodBody(upsertAutomationRuleSchema) body: UpsertAutomationRuleInput,
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

  // email templates
  @Get("email-templates")
  listEmailTemplates() {
    return this.emailTemplates.list();
  }

  @Get("email-templates/:key")
  getEmailTemplate(@Param("key") key: string) {
    return this.emailTemplates.get(key);
  }

  @Patch("email-templates/:key")
  updateEmailTemplate(
    @Param("key") key: string,
    @ZodBody(upsertEmailTemplateSchema) body: UpsertEmailTemplateInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.emailTemplates.upsert(key, body, user.id);
  }

  @Delete("email-templates/:key")
  resetEmailTemplate(@Param("key") key: string) {
    return this.emailTemplates.resetToDefault(key);
  }

  @Post("email-templates/:key/preview")
  async previewEmailTemplate(
    @Param("key") key: string,
    @ZodBody(previewEmailTemplateSchema) body: PreviewEmailTemplateInput,
  ) {
    const draft = body.subject && body.body ? { ...body, subject: body.subject, body: body.body } : undefined;
    const { subject, html } = await this.emailTemplates.preview(key, draft);
    return { subject, html };
  }

  @Post("email-templates/:key/test-send")
  async testSendEmailTemplate(@Param("key") key: string, @CurrentUser() user: RequestUser) {
    await this.email.sendTestEmail(key, user.email);
    return { ok: true };
  }
}

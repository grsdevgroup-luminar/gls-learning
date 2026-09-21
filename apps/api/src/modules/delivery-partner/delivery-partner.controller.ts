import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { memoryStorage } from "multer";
import {
  AdminDeliveryPartnerApplicationQuerySchema,
  AdminDeliveryPartnerQuerySchema,
  AssignPartnerCourseSchema,
  CreatePartnerCampaignSchema,
  InvitePartnerMemberSchema,
  ReviewPartnerApplicationSchema,
  UpdatePartnerCampaignSchema,
  UpdatePartnerCourseAssignmentSchema,
  UpdatePartnerSchema,
  type AdminDeliveryPartnerApplicationQuery,
  type AdminDeliveryPartnerQuery,
  type AssignPartnerCourseInput,
  type CreatePartnerCampaignInput,
  type InvitePartnerMemberInput,
  type ReviewPartnerApplicationInput,
  type UpdatePartnerCampaignInput,
  type UpdatePartnerCourseAssignmentInput,
  type UpdatePartnerInput,
} from "@skillstream/shared";
import { CurrentUser, Public, Roles, type RequestUser } from "../../common/decorators/decorators";
import { ZodBody, ZodQuery } from "../../common/utils/swagger";
import { PARTNER_DOC_MAX_BYTES } from "../storage/storage.constants";
import { DeliveryPartnerService } from "./delivery-partner.service";
import { PartnerDocFilePipe, type ValidatedPartnerDocFile } from "./pipes/partner-doc-file.pipe";

@ApiTags("delivery-partner")
@ApiBearerAuth()
@Controller()
export class DeliveryPartnerController {
  constructor(private readonly partners: DeliveryPartnerService) {}

  // Only reachable right after POST /auth/register-delivery-partner creates
  // the pending application — there is no standalone "apply" endpoint (see
  // DELIVERY_PARTNER_MEMBER_FLOW_PLAN.md §2): applying is only ever the
  // combined signup+apply step for a brand-new visitor.
  @Post("delivery-partners/apply/docs")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: PARTNER_DOC_MAX_BYTES },
    }),
  )
  uploadDocument(
    @CurrentUser() user: RequestUser,
    @Body("title") title: string,
    @UploadedFile(PartnerDocFilePipe) file: ValidatedPartnerDocFile,
  ) {
    if (!title?.trim()) throw new BadRequestException("Document title is required");
    return this.partners.uploadDocument(user, title, file);
  }

  @Get("me/delivery-partner")
  me(@CurrentUser() user: RequestUser) {
    return this.partners.me(user);
  }

  @Get("me/delivery-partner/application")
  myApplication(@CurrentUser() user: RequestUser) {
    return this.partners.myApplication(user);
  }

  @Get("me/delivery-partner/referrals")
  myReferrals(@CurrentUser() user: RequestUser) {
    return this.partners.myReferrals(user);
  }

  @Get("me/delivery-partner/courses")
  myCourseAssignments(@CurrentUser() user: RequestUser) {
    return this.partners.myCourseAssignments(user);
  }

  /** Every course the caller has access to via a delivery partner —
   *  deliberately separate from org-granted courses, see
   *  DELIVERY_PARTNER_MEMBER_FLOW_PLAN.md §6.3. */
  @Get("me/delivery-partner/granted-courses")
  myGrantedCourses(@CurrentUser() user: RequestUser) {
    return this.partners.myGrantedCourses(user);
  }

  /** Read-only — partners don't create their own campaigns, only admins do.
   *  Shows the code to share plus full history (current + past). */
  @Get("me/delivery-partner/campaigns")
  myCampaigns(@CurrentUser() user: RequestUser) {
    return this.partners.myCampaigns(user);
  }

  /** Every direct-invite member/pending-invite across all of the caller's
   *  course assignments — the partner-wide counterpart to the per-assignment
   *  listMembers/listInvitations below. */
  @Get("me/delivery-partner/members")
  myMembers(@CurrentUser() user: RequestUser) {
    return this.partners.myMembers(user);
  }

  @Get("me/delivery-partner/invitations")
  myInvitations(@CurrentUser() user: RequestUser) {
    return this.partners.myInvitations(user);
  }

  // ── members + invitations (partner-authenticated; per course assignment) ──
  @Post("delivery-partner/courses/:courseAssignmentId/invite")
  inviteMember(
    @CurrentUser() user: RequestUser,
    @Param("courseAssignmentId") courseAssignmentId: string,
    @ZodBody(InvitePartnerMemberSchema) body: InvitePartnerMemberInput,
  ) {
    return this.partners.inviteMember(user, courseAssignmentId, body);
  }

  @Get("delivery-partner/courses/:courseAssignmentId/invitations")
  listInvitations(
    @CurrentUser() user: RequestUser,
    @Param("courseAssignmentId") courseAssignmentId: string,
  ) {
    return this.partners.listInvitations(user, courseAssignmentId);
  }

  @Get("delivery-partner/courses/:courseAssignmentId/members")
  listMembers(
    @CurrentUser() user: RequestUser,
    @Param("courseAssignmentId") courseAssignmentId: string,
  ) {
    return this.partners.listMembers(user, courseAssignmentId);
  }

  @Delete("delivery-partner/invitations/:inviteId")
  revokeInvitation(@CurrentUser() user: RequestUser, @Param("inviteId") inviteId: string) {
    return this.partners.revokeInvitation(user, inviteId);
  }

  @Delete("delivery-partner/members/:memberId")
  removeMember(@CurrentUser() user: RequestUser, @Param("memberId") memberId: string) {
    return this.partners.removeMember(user, memberId);
  }

  // ── invitation claim (public preview + authenticated accept) ─────────────
  @Public()
  @Get("delivery-partner/invitations/:token")
  invitationInfo(@Param("token") token: string) {
    return this.partners.invitationInfo(token);
  }

  @Post("delivery-partner/claim/:token")
  claim(@CurrentUser() user: RequestUser, @Param("token") token: string) {
    return this.partners.claimInvitation(user, token);
  }

  // ── admin ──
  @Roles("ADMIN")
  @Get("admin/delivery-partner-applications")
  listApplications(
    @ZodQuery(AdminDeliveryPartnerApplicationQuerySchema)
    query: AdminDeliveryPartnerApplicationQuery,
  ) {
    return this.partners.listApplications(query);
  }

  @Roles("ADMIN")
  @Get("admin/delivery-partner-applications/stats")
  applicationStats() {
    return this.partners.applicationStats();
  }

  @Roles("ADMIN")
  @Post("admin/delivery-partner-applications/:id/review")
  review(
    @Param("id") id: string,
    @ZodBody(ReviewPartnerApplicationSchema)
    body: ReviewPartnerApplicationInput,
  ) {
    return this.partners.reviewApplication(id, body);
  }

  @Roles("ADMIN")
  @Get("admin/delivery-partners")
  listPartners(
    @ZodQuery(AdminDeliveryPartnerQuerySchema) query: AdminDeliveryPartnerQuery,
  ) {
    return this.partners.listPartners(query);
  }

  @Roles("ADMIN")
  @Patch("admin/delivery-partners/:id")
  updatePartner(
    @Param("id") id: string,
    @ZodBody(UpdatePartnerSchema) body: UpdatePartnerInput,
  ) {
    return this.partners.updatePartner(id, body);
  }

  // ── course assignment (admin-only) ────────────────────────────────────────
  @Roles("ADMIN")
  @Get("admin/delivery-partners/:id/courses")
  listCourseAssignments(@Param("id") id: string) {
    return this.partners.listCourseAssignments(id);
  }

  @Roles("ADMIN")
  @Post("admin/delivery-partners/:id/courses")
  assignCourse(
    @Param("id") id: string,
    @ZodBody(AssignPartnerCourseSchema) body: AssignPartnerCourseInput,
  ) {
    return this.partners.assignCourse(id, body);
  }

  @Roles("ADMIN")
  @Patch("admin/delivery-partners/:id/courses/:courseId")
  updateCourseAssignment(
    @Param("id") id: string,
    @Param("courseId") courseId: string,
    @ZodBody(UpdatePartnerCourseAssignmentSchema) body: UpdatePartnerCourseAssignmentInput,
  ) {
    return this.partners.updateCourseAssignment(id, courseId, body);
  }

  @Roles("ADMIN")
  @Delete("admin/delivery-partners/:id/courses/:courseId")
  unassignCourse(@Param("id") id: string, @Param("courseId") courseId: string) {
    return this.partners.unassignCourse(id, courseId);
  }

  // ── campaigns (admin-only) ────────────────────────────────────────────────
  @Roles("ADMIN")
  @Get("admin/delivery-partners/:id/campaigns")
  listCampaigns(@Param("id") id: string) {
    return this.partners.listCampaigns(id);
  }

  @Roles("ADMIN")
  @Post("admin/delivery-partners/:id/campaigns")
  createCampaign(
    @Param("id") id: string,
    @ZodBody(CreatePartnerCampaignSchema) body: CreatePartnerCampaignInput,
  ) {
    return this.partners.createCampaign(id, body);
  }

  @Roles("ADMIN")
  @Patch("admin/delivery-partners/:id/campaigns/:campaignId")
  updateCampaign(
    @Param("id") id: string,
    @Param("campaignId") campaignId: string,
    @ZodBody(UpdatePartnerCampaignSchema) body: UpdatePartnerCampaignInput,
  ) {
    return this.partners.updateCampaign(id, campaignId, body);
  }

  @Roles("ADMIN")
  @Delete("admin/delivery-partners/:id/campaigns/:campaignId")
  deleteCampaign(@Param("id") id: string, @Param("campaignId") campaignId: string) {
    return this.partners.deleteCampaign(id, campaignId);
  }
}

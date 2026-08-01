import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  AssignOrgCourseSchema,
  CreateOrganizationSchema,
  InviteOrgMemberSchema,
  UpdateOrganizationSchema,
  type AssignOrgCourseInput,
  type CreateOrganizationInput,
  type InviteOrgMemberInput,
  type UpdateOrganizationInput,
} from "@skillstream/shared";
import { CurrentUser, Public, Roles, type RequestUser } from "../common/decorators";
import { ZodBody } from "../common/swagger";
import { OrganizationsService } from "./organizations.service";

@ApiTags("organizations")
@ApiBearerAuth()
@Controller()
export class OrganizationsController {
  constructor(private readonly orgs: OrganizationsService) {}

  @Roles("ADMIN")
  @Post("organizations")
  create(
    @ZodBody(CreateOrganizationSchema)
    body: CreateOrganizationInput,
  ) {
    return this.orgs.create(body);
  }

  @Roles("ADMIN")
  @Get("organizations")
  list() {
    return this.orgs.list();
  }

  @Get("me/organizations")
  mine(@CurrentUser() user: RequestUser) {
    return this.orgs.myOrganizations(user);
  }

  @Public()
  @Get("organizations/invitations/:token")
  invitationInfo(@Param("token") token: string) {
    return this.orgs.invitationInfo(token);
  }

  @Post("organizations/claim/:token")
  claim(@CurrentUser() user: RequestUser, @Param("token") token: string) {
    return this.orgs.claimInvitation(user, token);
  }

  @Get("organizations/:id")
  get(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.orgs.get(user, id);
  }

  @Patch("organizations/:id")
  update(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @ZodBody(UpdateOrganizationSchema)
    body: UpdateOrganizationInput,
  ) {
    return this.orgs.update(user, id, body);
  }

  @Post("organizations/:id/invite")
  invite(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @ZodBody(InviteOrgMemberSchema) body: InviteOrgMemberInput,
  ) {
    return this.orgs.invite(user, id, body);
  }

  @Delete("organizations/:id/members/:memberId")
  removeMember(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Param("memberId") memberId: string,
  ) {
    return this.orgs.removeMember(user, id, memberId);
  }

  @Get("organizations/:id/invitations")
  listInvitations(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.orgs.listInvitations(user, id);
  }

  @Delete("organizations/:id/invitations/:inviteId")
  revokeInvitation(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Param("inviteId") inviteId: string,
  ) {
    return this.orgs.revokeInvitation(user, id, inviteId);
  }

  @Get("organizations/:id/courses")
  listCourses(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.orgs.listCourses(user, id);
  }

  @Post("organizations/:id/courses")
  assignCourse(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @ZodBody(AssignOrgCourseSchema) body: AssignOrgCourseInput,
  ) {
    return this.orgs.assignCourse(user, id, body);
  }

  @Delete("organizations/:id/courses/:courseId")
  unassignCourse(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Param("courseId") courseId: string,
  ) {
    return this.orgs.unassignCourse(user, id, courseId);
  }
}

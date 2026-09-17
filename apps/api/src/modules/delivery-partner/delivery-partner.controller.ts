import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { memoryStorage } from "multer";
import {
  AdminDeliveryPartnerApplicationQuerySchema,
  AdminDeliveryPartnerQuerySchema,
  ApplyDeliveryPartnerSchema,
  ReviewPartnerApplicationSchema,
  UpdatePartnerSchema,
  type AdminDeliveryPartnerApplicationQuery,
  type AdminDeliveryPartnerQuery,
  type ApplyDeliveryPartnerInput,
  type ReviewPartnerApplicationInput,
  type UpdatePartnerInput,
} from "@skillstream/shared";
import { CurrentUser, Roles, type RequestUser } from "../../common/decorators/decorators";
import { ZodBody, ZodQuery } from "../../common/utils/swagger";
import { PARTNER_DOC_MAX_BYTES } from "../storage/storage.constants";
import { DeliveryPartnerService } from "./delivery-partner.service";
import { PartnerDocFilePipe, type ValidatedPartnerDocFile } from "./pipes/partner-doc-file.pipe";

@ApiTags("delivery-partner")
@ApiBearerAuth()
@Controller()
export class DeliveryPartnerController {
  constructor(private readonly partners: DeliveryPartnerService) {}

  @Post("delivery-partners/apply")
  apply(
    @CurrentUser() user: RequestUser,
    @ZodBody(ApplyDeliveryPartnerSchema) body: ApplyDeliveryPartnerInput,
  ) {
    return this.partners.apply(user, body);
  }

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

  @Delete("delivery-partners/apply/docs")
  deleteDocument(@CurrentUser() user: RequestUser, @Query("key") key?: string) {
    if (!key) throw new BadRequestException("key is required");
    return this.partners.deleteDocument(user, key);
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
}

import { forwardRef, Module } from "@nestjs/common";
import { ReviewsModule } from "../reviews/reviews.module";
import { CommerceModule } from "../commerce/commerce.module";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { AdminRepository } from "./admin.repository";
import { CategoriesModule } from "../categories/categories.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { DeliveryPartnerModule } from "../delivery-partner/delivery-partner.module";

@Module({
  // forwardRef on OrganizationsModule: it already imports AdminModule (for
  // memberProfile's delegation to AdminService.studentProfile) — see
  // OrganizationsModule's matching forwardRef.
  imports: [
    ReviewsModule,
    CommerceModule,
    CategoriesModule,
    forwardRef(() => OrganizationsModule),
    DeliveryPartnerModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminRepository],
  exports: [AdminService],
})
export class AdminModule {}

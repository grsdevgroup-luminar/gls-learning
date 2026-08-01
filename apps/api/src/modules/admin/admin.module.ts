import { Module } from "@nestjs/common";
import { ReviewsModule } from "../reviews/reviews.module";
import { CommerceModule } from "../commerce/commerce.module";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { AdminRepository } from "./admin.repository";

@Module({
  imports: [ReviewsModule, CommerceModule],
  controllers: [AdminController],
  providers: [AdminService, AdminRepository],
  exports: [AdminService],
})
export class AdminModule {}

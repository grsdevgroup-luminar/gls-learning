import { Module } from "@nestjs/common";
import { ReviewsModule } from "../reviews/reviews.module";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";

@Module({
  imports: [ReviewsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}

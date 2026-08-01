import { Module } from "@nestjs/common";
import { EnrollmentModule } from "../enrollment/enrollment.module";
import { ReviewsController } from "./reviews.controller";
import { ReviewsService } from "./reviews.service";
import { ReviewsRepository } from "./reviews.repository";

@Module({
  imports: [EnrollmentModule],
  controllers: [ReviewsController],
  providers: [ReviewsService, ReviewsRepository],
  exports: [ReviewsService],
})
export class ReviewsModule {}

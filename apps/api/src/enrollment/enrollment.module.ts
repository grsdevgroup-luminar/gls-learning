import { Module } from "@nestjs/common";
import { EnrollmentController } from "./enrollment.controller";
import { EnrollmentService } from "./enrollment.service";
import { EnrollmentRepository } from "./enrollment.repository";

@Module({
  controllers: [EnrollmentController],
  providers: [EnrollmentService, EnrollmentRepository],
  exports: [EnrollmentService],
})
export class EnrollmentModule {}

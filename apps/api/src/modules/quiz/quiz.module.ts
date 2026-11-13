import { Module } from "@nestjs/common";
import { EnrollmentModule } from "../enrollment/enrollment.module";
import { QuizController, QuizReviewController } from "./quiz.controller";
import { QuizService } from "./quiz.service";
import { QuizRepository } from "./quiz.repository";

@Module({
  imports: [EnrollmentModule],
  controllers: [QuizController, QuizReviewController],
  providers: [QuizService, QuizRepository],
})
export class QuizModule {}

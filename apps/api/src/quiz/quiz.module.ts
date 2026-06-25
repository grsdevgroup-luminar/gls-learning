import { Module } from "@nestjs/common";
import { EnrollmentModule } from "../enrollment/enrollment.module";
import { QuizController } from "./quiz.controller";
import { QuizService } from "./quiz.service";

@Module({
  imports: [EnrollmentModule],
  controllers: [QuizController],
  providers: [QuizService],
})
export class QuizModule {}

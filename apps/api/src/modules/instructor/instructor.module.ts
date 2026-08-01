import { Module } from "@nestjs/common";
import { InstructorController } from "./instructor.controller";
import { InstructorService } from "./instructor.service";
import { InstructorRepository } from "./instructor.repository";

@Module({
  controllers: [InstructorController],
  providers: [InstructorService, InstructorRepository],
})
export class InstructorModule {}

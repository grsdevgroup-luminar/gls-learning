import { Module } from "@nestjs/common";
import { NotesController } from "./notes.controller";
import { NotesService } from "./notes.service";
import { NotesRepository } from "./notes.repository";
import { EnrollmentModule } from "../enrollment/enrollment.module";

@Module({
  imports: [EnrollmentModule],
  controllers: [NotesController],
  providers: [NotesService, NotesRepository],
})
export class NotesModule {}

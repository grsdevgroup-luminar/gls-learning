import { Controller, Get, Param, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  saveLessonNoteSchema,
  type SaveLessonNoteInput,
} from "@skillstream/shared";
import { CurrentUser, type RequestUser } from "../common/decorators";
import { ZodBody } from "../common/swagger";
import { NotesService } from "./notes.service";

@ApiTags("notes")
@ApiBearerAuth()
@Controller("me/lessons/:lessonId/note")
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Get()
  @ApiOperation({
    summary: "Read your note for a lesson",
    description: "Returns null when nothing has been written yet.",
  })
  get(@CurrentUser() user: RequestUser, @Param("lessonId") lessonId: string) {
    return this.notes.get(user.id, lessonId);
  }

  @Put()
  @ApiOperation({
    summary: "Write your note for a lesson",
    description:
      "Upsert — requires an enrollment in the lesson's course. An empty body deletes the note and returns null.",
  })
  save(
    @CurrentUser() user: RequestUser,
    @Param("lessonId") lessonId: string,
    @ZodBody(saveLessonNoteSchema) body: SaveLessonNoteInput,
  ) {
    return this.notes.save(user.id, lessonId, body.body);
  }
}

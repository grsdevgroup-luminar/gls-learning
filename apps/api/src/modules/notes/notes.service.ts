import { Injectable } from "@nestjs/common";
import type { LessonNoteDto } from "@skillstream/shared";
import { EnrollmentService } from "../enrollment/enrollment.service";
import { NotesRepository } from "./notes.repository";

@Injectable()
export class NotesService {
  constructor(
    private readonly repo: NotesRepository,
    private readonly enrollment: EnrollmentService,
  ) {}

  /**
   * Notes are private study material for a course the learner has access to,
   * so writing one requires an enrollment — otherwise the table doubles as
   * free storage for anyone with an account.
   */
  async get(userId: string, lessonId: string): Promise<LessonNoteDto | null> {
    await this.enrollment.assertLessonAccessible(userId, lessonId);
    const note = await this.repo.findNote(userId, lessonId);
    return note
      ? {
          lessonId: note.lessonId,
          body: note.body,
          updatedAt: note.updatedAt.toISOString(),
        }
      : null;
  }

  /** Upsert; an empty body deletes the row rather than storing a blank note. */
  async save(
    userId: string,
    lessonId: string,
    body: string,
  ): Promise<LessonNoteDto | null> {
    await this.enrollment.assertLessonAccessible(userId, lessonId);

    if (body.trim() === "") {
      await this.repo.deleteNote(userId, lessonId).catch(() => undefined);
      return null;
    }

    const note = await this.repo.upsertNote(userId, lessonId, body);
    return {
      lessonId: note.lessonId,
      body: note.body,
      updatedAt: note.updatedAt.toISOString(),
    };
  }
}

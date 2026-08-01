import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { LessonNoteDto } from "@skillstream/shared";
import { NotesRepository } from "./notes.repository";

@Injectable()
export class NotesService {
  constructor(private readonly repo: NotesRepository) {}

  /**
   * Notes are private study material for a course the learner has access to,
   * so writing one requires an enrollment — otherwise the table doubles as
   * free storage for anyone with an account.
   */
  private async assertEnrolled(userId: string, lessonId: string): Promise<void> {
    const lesson = await this.repo.findLessonCourseId(lessonId);
    if (!lesson) throw new NotFoundException("Lesson not found");

    const enrolled = await this.repo.countEnrollment(userId, lesson.section.courseId);
    if (enrolled === 0)
      throw new ForbiddenException("Enroll in this course to take notes");
  }

  async get(userId: string, lessonId: string): Promise<LessonNoteDto | null> {
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
    await this.assertEnrolled(userId, lessonId);

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

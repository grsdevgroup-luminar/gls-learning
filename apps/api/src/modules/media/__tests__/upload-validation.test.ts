import { describe, it, expect } from "vitest";
import { UploadStatus } from "@prisma/client";
import { assertAttachableUpload, assertDiscardableUpload } from "../upload-validation";

const baseUpload = {
  ownerUserId: "user_1",
  cloudflareUid: "cf_vid_1",
  courseId: "course_1",
  lessonId: null,
  status: UploadStatus.READY,
} as const;

const baseInput = {
  uid: "cf_vid_1",
  userId: "user_1",
  courseId: "course_1",
} as const;

describe("assertAttachableUpload", () => {
  it("accepts a PROCESSING upload owned by the caller", () => {
    expect(() =>
      assertAttachableUpload(
        { ...baseUpload, status: UploadStatus.PROCESSING },
        baseInput,
      ),
    ).not.toThrow();
  });

  it("rejects when no upload row exists", () => {
    expect(() => assertAttachableUpload(null, baseInput)).toThrow(
      "Video upload not found or not authorized",
    );
  });

  it("rejects cross-owner attachment even for admins", () => {
    expect(() =>
      assertAttachableUpload(baseUpload, { ...baseInput, userId: "admin_1" }),
    ).toThrow("Video upload not found or not authorized");
  });

  it("rejects UPLOADING status", () => {
    expect(() =>
      assertAttachableUpload(
        { ...baseUpload, status: UploadStatus.UPLOADING },
        baseInput,
      ),
    ).toThrow("not ready to attach");
  });

  it("rejects when already attached to a different lesson", () => {
    expect(() =>
      assertAttachableUpload(
        { ...baseUpload, lessonId: "lesson_other" },
        { ...baseInput, lessonId: "lesson_1" },
      ),
    ).toThrow("already attached to another lesson");
  });

  it("allows re-attach to the same lesson on update", () => {
    expect(() =>
      assertAttachableUpload(
        { ...baseUpload, lessonId: "lesson_1" },
        { ...baseInput, lessonId: "lesson_1" },
      ),
    ).not.toThrow();
  });

  it("rejects course mismatch when upload was scoped to another course", () => {
    expect(() =>
      assertAttachableUpload(
        { ...baseUpload, courseId: "course_other" },
        baseInput,
      ),
    ).toThrow("different course");
  });
});

describe("assertDiscardableUpload", () => {
  it("rejects discard when linked to a lesson", () => {
    expect(() =>
      assertDiscardableUpload({ lessonId: "lesson_1" }),
    ).toThrow("attached to a lesson");
  });

  it("allows discard when unattached", () => {
    expect(() => assertDiscardableUpload({ lessonId: null })).not.toThrow();
  });
});

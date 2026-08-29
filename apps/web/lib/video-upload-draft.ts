export interface VideoUploadDraft {
  uploadId: string;
  uploadUrl: string;
  uid: string;
  fileFingerprint: string;
  filename: string;
  expiresAt: string;
}

function draftKey(courseId: string | undefined, lessonId: string): string {
  return `skillstream:upload-draft:${courseId ?? "new"}:${lessonId}`;
}

export function readVideoUploadDraft(
  courseId: string | undefined,
  lessonId: string,
): VideoUploadDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(draftKey(courseId, lessonId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as VideoUploadDraft;
    if (!draft.uploadId || !draft.uploadUrl || !draft.fileFingerprint) return null;
    if (Date.parse(draft.expiresAt) <= Date.now()) {
      localStorage.removeItem(draftKey(courseId, lessonId));
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export function writeVideoUploadDraft(
  courseId: string | undefined,
  lessonId: string,
  draft: VideoUploadDraft,
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(draftKey(courseId, lessonId), JSON.stringify(draft));
}

export function clearVideoUploadDraft(
  courseId: string | undefined,
  lessonId: string,
): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(draftKey(courseId, lessonId));
}

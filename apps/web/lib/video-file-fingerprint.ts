import { SUPPORTED_VIDEO_EXTENSIONS } from "@skillstream/shared";

/** Stable resume key without hashing the full file contents. */
export function videoFileFingerprint(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export function isSupportedVideoFile(file: File): boolean {
  const dot = file.name.lastIndexOf(".");
  if (dot < 1) return false;
  const ext = file.name.slice(dot).toLowerCase();
  return (SUPPORTED_VIDEO_EXTENSIONS as readonly string[]).includes(ext);
}

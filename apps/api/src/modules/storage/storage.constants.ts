/** Injection token for the resolved StorageDriver — services depend on the
 *  interface, the factory decides which driver is bound to this token. */
export const STORAGE_DRIVER = Symbol("STORAGE_DRIVER");

/** Extension → allowed MIME. Used both to whitelist uploads and to derive the
 *  extension we persist alongside the ULID key. Keep entries lowercase; the
 *  pipe matches case-insensitively. */
export const ALLOWED_RESOURCE_MIME: Readonly<Record<string, readonly string[]>> = {
  pdf: ["application/pdf"],
  zip: ["application/zip", "application/x-zip-compressed"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  gif: ["image/gif"],
  webp: ["image/webp"],
  doc: ["application/msword"],
  docx: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  ppt: ["application/vnd.ms-powerpoint"],
  pptx: [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ],
  xls: ["application/vnd.ms-excel"],
  xlsx: [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  txt: ["text/plain"],
  csv: ["text/csv", "application/csv"],
  mp3: ["audio/mpeg", "audio/mp3"],
} as const;

/** Flat MIME set for O(1) lookup. */
export const ALLOWED_RESOURCE_MIME_SET: ReadonlySet<string> = new Set(
  Object.values(ALLOWED_RESOURCE_MIME).flat(),
);

/** All accepted file extensions, no leading dot. */
export const ALLOWED_RESOURCE_EXTENSIONS: readonly string[] = Object.keys(
  ALLOWED_RESOURCE_MIME,
);

/** Object-key prefix under the bucket / local upload dir. Keeps room for
 *  future prefixes (`avatars/`, `thumbnails/`) without collision. */
export const RESOURCE_KEY_PREFIX = "resources";

import type { Readable } from "node:stream";

/** Result of a successful `put`. `key` is the internal handle callers persist
 *  (so a delete later has something to name); `url` is what the browser hits. */
export interface StoredObject {
  key: string;
  url: string;
  bytes: number;
  contentType: string;
}

export interface PutInput {
  /** Fully-namespaced key, e.g. `resources/{lessonId}/{ulid}.pdf`. The driver
   *  does not add its own prefix — callers own the layout. */
  key: string;
  body: Buffer | Readable;
  contentType: string;
  contentLength: number;
  /** Original client filename, sanitized. Used for Content-Disposition so the
   *  browser saves with a sensible name even though the key is a ULID. */
  originalName: string;
}

/**
 * Storage backend abstraction. Two implementations exist today (local disk,
 * S3-compatible bucket) and services depend only on this shape.
 *
 * Contract:
 *  - `put` returns a URL that works right now. For private buckets that means
 *    a signed URL; local returns a static path served by ServeStaticModule.
 *  - `getUrl` re-mints the URL. Signed URLs from `put` may have expired by the
 *    time a learner opens the lesson; call `getUrl` on the read path.
 *  - `delete` is idempotent — deleting a missing key must not throw.
 */
export interface StorageDriver {
  put(input: PutInput): Promise<StoredObject>;
  delete(key: string): Promise<void>;
  getUrl(key: string): Promise<string>;
}

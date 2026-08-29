D# Lesson Resource Upload — Implementation Plan

## Goal

Let instructors attach downloadable files (PDF, ZIP, images, slides, etc.) to any lesson during course create/edit. Multiple files per lesson, max **10 MB** per file. In local dev the file lands on disk under the API app; in production it lands in a **Railway-hosted S3-compatible bucket**. Backend picks the driver via a **factory** so callers stay storage-agnostic.

Today a lesson resource is a `{ name, url, sizeLabel }` link only (see `packages/shared/src/contracts/authoring.ts:48-53`). We keep that shape — `url` will now point to either a local `/uploads/...` path or a bucket URL — and add an upload endpoint that returns that triple.

---

## Constraints & decisions

- **Max size:** 10 MB, enforced (a) on frontend before submit, (b) on backend via multer limit, (c) on presigned-URL policy in prod.
- **Count:** cap already exists — `lessonResourceSchema` allows `.max(20)`. Keep.
- **Allowed types:** whitelist by MIME + extension. Start with: `pdf, zip, png, jpg, jpeg, gif, webp, doc, docx, ppt, pptx, xls, xlsx, txt, csv, mp3`. Reject everything else.
- **Storage driver chosen by `NODE_ENV`** (dev/test → local, production → S3). Overridable with `STORAGE_DRIVER=local|s3` for staging/debug.
- **Filenames:** never trust client name. Store as `resources/{lessonId or ulid}/{ulid}.{ext}`. Keep original name in the DB `name` field only.
- **URL scheme:**
  - Local: served by Nest via `ServeStaticModule` at `/uploads/*`. Persisted URL is absolute: `${PUBLIC_API_URL}/uploads/...`.
  - Prod (S3): store the **object key** in DB; return a **signed GET URL** at read time (short-lived, e.g. 1h) OR store a public URL if the bucket is public-read. Default plan: **private bucket + signed URL on read**.
- **Upload path (prod):** two options — pick one:
  - **A. Server-proxied (simple):** client POSTs multipart to API → API streams to S3. Simple, single 10 MB hop, uses API bandwidth.
  - **B. Presigned PUT (efficient):** API returns presigned URL + fields; client PUTs directly to S3, then calls a confirm endpoint. No API bandwidth.
  - **Recommendation: A** for v1. Files are only 10 MB, instructor traffic is low, and it keeps the local/prod code paths symmetric (same endpoint contract). Revisit if bandwidth becomes an issue.

---

## Storage abstraction (factory pattern)

### Interface

`apps/api/src/modules/storage/storage.driver.ts`

```ts
export interface StoredObject {
  key: string;       // internal handle (path or S3 key)
  url: string;       // public/signed URL usable in <a href>
  bytes: number;
  contentType: string;
}

export interface StorageDriver {
  put(input: {
    key: string;              // caller-supplied, already namespaced
    body: Buffer | Readable;
    contentType: string;
    contentLength: number;
    originalName: string;
  }): Promise<StoredObject>;

  delete(key: string): Promise<void>;

  /** Returns a URL usable now. For private buckets this is signed. */
  getUrl(key: string): Promise<string>;
}
```

### Drivers

- `apps/api/src/modules/storage/drivers/local.driver.ts` — writes under `apps/api/uploads/` (git-ignored). `getUrl` returns `${PUBLIC_API_URL}/uploads/${key}` (or relative if `PUBLIC_API_URL` unset). Uses `fs/promises`.
- `apps/api/src/modules/storage/drivers/s3.driver.ts` — uses `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`. Endpoint / region / bucket read from env. `getUrl` returns a `GetObjectCommand` presigned URL (TTL configurable, default 1h). Works with any S3-compatible service — Railway bucket, AWS S3, Cloudflare R2 — because they all speak S3.

### Factory

`apps/api/src/modules/storage/storage.factory.ts`

```ts
@Injectable()
export class StorageFactory {
  constructor(private readonly config: ConfigService<Env, true>) {}

  create(): StorageDriver {
    const driver =
      this.config.get("STORAGE_DRIVER", { infer: true }) ??
      (this.config.get("NODE_ENV", { infer: true }) === "production" ? "s3" : "local");

    if (driver === "s3") return new S3Driver(this.config);
    return new LocalDriver(this.config);
  }
}
```

Nest-friendly wiring: expose the resolved driver as a provider (`STORAGE_DRIVER` token) so services inject `StorageDriver`, not the factory:

```ts
{
  provide: STORAGE_DRIVER,
  useFactory: (f: StorageFactory) => f.create(),
  inject: [StorageFactory],
}
```

Services depend on the interface only — adding a new backend later means one new driver file plus one line in the factory.

---

## Backend changes

### 1. Env schema — `apps/api/src/config/env.ts`

Add:

```ts
STORAGE_DRIVER: z.enum(["local", "s3"]).optional(),
STORAGE_LOCAL_DIR: z.string().default("uploads"),
STORAGE_MAX_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
STORAGE_SIGNED_URL_TTL_SEC: z.coerce.number().int().positive().default(3600),

// S3 / Railway bucket
S3_ENDPOINT: z.string().url().optional(),   // Railway/R2 endpoint
S3_REGION: z.string().default("auto"),
S3_BUCKET: z.string().optional(),
S3_ACCESS_KEY_ID: z.string().optional(),
S3_SECRET_ACCESS_KEY: z.string().optional(),
S3_FORCE_PATH_STYLE: z.enum(["true", "false"]).optional()
  .transform(v => v === "true"),
S3_PUBLIC_BASE_URL: z.string().url().optional(), // optional public read
```

Add a `superRefine`: when the resolved driver is `s3`, require `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. Fail boot loudly in prod if missing.

### 2. New module — `apps/api/src/modules/storage/`

Files:

- `storage.module.ts` — exports `STORAGE_DRIVER` provider.
- `storage.driver.ts` — interface + `STORAGE_DRIVER` token.
- `storage.factory.ts` — factory shown above.
- `drivers/local.driver.ts`
- `drivers/s3.driver.ts`
- `storage.constants.ts` — allowed MIME whitelist, extension map.

### 3. Static serving (local only)

In `app.module.ts`, register `ServeStaticModule.forRoot({ rootPath: join(process.cwd(), env.STORAGE_LOCAL_DIR), serveRoot: "/uploads", serveStaticOptions: { index: false } })` **only when driver is `local`**. Prevents accidental disk exposure in prod.

Add `apps/api/uploads/` to `.gitignore` and add `apps/api/uploads/.gitkeep`.

### 4. Upload endpoint — new controller

`apps/api/src/modules/authoring/lesson-resource.controller.ts` (or extend `authoring.controller.ts` — probably cleaner as a sub-controller).

```
POST /authoring/lessons/:lessonId/resources
  - Guard: JWT + role INSTRUCTOR|ADMIN
  - Ownership guard: lesson.section.course.ownerId === user.id (ADMIN bypass)
  - multipart/form-data, field name: "file"
  - Uses @nestjs/platform-express + multer memoryStorage
  - MulterModule limit: fileSize = STORAGE_MAX_BYTES
  - Validates MIME whitelist in a pipe
  - Calls StorageDriver.put(...)
  - Appends { name, url, sizeLabel } to lesson.resources JSON (transaction)
  - Returns LessonResourceDto

DELETE /authoring/lessons/:lessonId/resources/:resourceKey
  - Same guards
  - Removes from JSON array + StorageDriver.delete(key)
```

Multer choice: **memoryStorage** for the 10 MB ceiling (streaming to S3/disk from buffer is fine at this size). If we ever raise the cap, switch to `diskStorage` with a temp dir, or pipe the request stream directly.

Global multer defaults live in `app.module.ts` — set the file-size cap there so multer rejects >10 MB **before** any handler code runs (returns 413).

### 5. Persistence — `apps/api/src/modules/authoring/authoring.repository.ts`

Two new methods:

- `appendLessonResource(lessonId, resource)` — read JSON, validate with `parseLessonResources`, append (respect `.max(20)`), write back.
- `removeLessonResource(lessonId, key)` — read, filter by stored key, write back.

We need the **object key** to be recoverable from the stored resource so DELETE can hit storage. Options:

- **(preferred) Widen the shared schema** to add an optional `storageKey?: string` on `lessonResourceSchema`. Keeps the on-disk JSON shape untouched for link-only legacy rows. `parseLessonResources` already ignores unknown fields via zod — this is a compatible addition.
- Or derive the key from the URL. Fragile; skip.

Migration: **none needed** — `Lesson.resources` is already `Json`. The new `storageKey` field is additive.

### 6. Existing lesson update payload

`updateLesson` DTO currently accepts a `resources` array. Keep it working (link-only rows still valid). The new upload endpoint is additive — it does not replace inline editing of link resources.

Conflict rule: if a client PATCHes `resources` and omits an uploaded item's `storageKey`, we would leak the S3 object. Two defenses:

- Repository diff on update: any item present before with a `storageKey` and now missing → call `StorageDriver.delete(key)` in the same transaction (best-effort; log on failure).
- Frontend always sends back the full array including `storageKey` for uploaded rows.

---

## Frontend changes

### 1. API client — `apps/web/lib/api/endpoints.ts`

Add to `authoringApi`:

```ts
uploadLessonResource(lessonId: string, file: File): Promise<LessonResourceDto>
deleteLessonResource(lessonId: string, storageKey: string): Promise<void>
```

`uploadLessonResource` uses `FormData` — needs a small variant of `apiFetch` that skips JSON `Content-Type` and lets the browser set the multipart boundary (mirrors `video-upload.tsx` behavior).

### 2. Shared type

Extend `LessonResourceDto` in `packages/shared/src/contracts/catalog.ts` and `LessonResourceInput` in `.../authoring.ts` with optional `storageKey?: string`.

### 3. Course builder UI — `apps/web/components/shared/course-builder.tsx`

In the lesson editor block (around lines 136-200 per investigator map):

- Add a **"Add resource"** area with two tabs / two buttons:
  - **Upload file** — `<input type="file" accept="…whitelist…">` → shows progress → on success appends `{ name, url, sizeLabel, storageKey }` to the lesson's `resources` array.
  - **Add link** — existing behavior (name + url text fields).
- Client-side guards before upload:
  - `file.size > 10 * 1024 * 1024` → toast + abort.
  - MIME/extension not in whitelist → toast + abort.
  - `resources.length >= 20` → disable buttons.
- List of existing resources: show name + size + a remove (X). Remove calls delete endpoint if `storageKey` present; otherwise strips locally.
- Format bytes → `sizeLabel` ("1.2 MB", "740 KB") with a small util.

Order of ops for new lessons: the upload endpoint needs a `lessonId`. Two flows:

- **Existing lesson (edit mode):** upload immediately, get back resource.
- **Brand-new lesson not yet saved:** either (a) buffer file client-side and upload after first `POST /authoring/sections/:id/lessons`, or (b) require the instructor to save the lesson skeleton once before the upload UI enables. Recommend (b) — matches how `cfVideoUid` already flows (video upload needs the lesson too). Disable the resource upload button with tooltip "Save the lesson to attach files".

### 4. Public read (student side)

`LessonResourceDto` already surfaces `url` — the URL served by the API is either a local `/uploads/...` path or a signed S3 URL. Signed URLs have TTL, so **do not** cache them long. Two options:

- **Simple:** fetch a fresh signed URL every time the lesson detail endpoint runs. Small overhead, safe. → **Recommended.**
- Optimized: cache signed URLs in Redis with a TTL slightly shorter than the S3 TTL.

The catalog service that returns a lesson to a student must call `StorageDriver.getUrl(storageKey)` for each uploaded resource before responding.

---

## Security

- **AuthN:** existing JWT guard.
- **AuthZ:** ownership check on lesson (course.ownerId) for upload/delete. ADMIN role bypass.
- **MIME sniffing:** trust `file.mimetype` from multer as a first pass, but also validate the extension against a whitelist. Store a normalized `contentType`.
- **Filename sanitation:** never use client filename for the storage key. Generate ULID + safe extension. Keep original name only for display (`name` field).
- **Rate limit:** throttle upload endpoint (e.g. Nest's ThrottlerGuard) — 20 uploads/min per user is generous.
- **Private bucket:** S3 bucket ACL private. Reads via short-lived signed URLs only. No `list` permissions on the IAM key.
- **CORS on the bucket:** not needed if we serve via signed GET only from the API. Needed only if we later switch to presigned PUT (flow B).
- **Local dev exposure:** `ServeStaticModule` is only mounted when driver is `local`. Prod cannot leak `/uploads/*`.
- **Path traversal:** keys are ULID-based, never client-supplied. Local driver `path.join` result is asserted to be inside `STORAGE_LOCAL_DIR` before writing/deleting.

---

## Testing

- Unit: `LocalDriver.put/delete/getUrl` with a temp dir. `S3Driver` against a mocked `S3Client`.
- Unit: `StorageFactory` picks the right driver by env.
- Integration (Nest): `POST /authoring/lessons/:id/resources` — 200 on happy path, 413 on >10 MB, 415 on bad MIME, 403 on non-owner, 404 on unknown lesson, 400 on >20 resources.
- Frontend: form validation blocks oversize/bad-MIME. Removing an uploaded row calls delete.

---

## Rollout order

1. Shared types — add `storageKey?: string` to lesson resource schemas. Rebuild shared package.
2. Env schema — new vars + prod refine.
3. `StorageModule` — interface, factory, both drivers, provider wiring.
4. `.gitignore` `apps/api/uploads/`.
5. Conditional `ServeStaticModule` in `app.module.ts`.
6. Upload / delete endpoints in `authoring` module + ownership guard + multer limit.
7. Catalog read path signs URLs before returning.
8. Frontend API methods.
9. Course builder UI — upload button, progress, delete.
10. Manual QA: local upload → view → delete → prod bucket dry-run on staging.
11. README section documenting env vars + Railway bucket setup.

---

## Open questions (please confirm before I start)

1. **Railway bucket** — do you have one provisioned already? If yes: endpoint URL + region convention. If no: I'll add the env vars and a README section, and you provision on Railway's dashboard.
2. **Public vs. private bucket** — plan assumes private + signed URL. Public read is simpler but any leaked URL is permanent. Confirm private.
3. **Allowed MIME list above** — anything to add/remove? (e.g. `.md`, `.json`, video files? Videos are already handled by Cloudflare Stream so probably not.)
4. **New lesson flow** — OK with "save lesson first, then attach files"? Matches current video behavior.
5. **Server-proxied vs. presigned PUT** — v1 = proxied (simpler, symmetric with local). Agree?

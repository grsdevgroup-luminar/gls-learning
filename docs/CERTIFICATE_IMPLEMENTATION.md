# Certificate System Implementation

## Status

Implemented certificate-template, ISO Standard, course-number, certificate issuance, verification, and authenticated PDF-download changes.

This document describes the certificate-related implementation currently in the repository. It is intentionally limited to the files and flows involved in certificates; unrelated worktree changes are not included.

## 1. Scope and key behavior

The certificate system now provides:

- An ISO Standard field in course creation and editing.
- Predefined ISO Standard choices plus an `Other` option for a manually entered value.
- A generated, unique course number for every newly created course.
- A course-number snapshot on each issued certificate.
- Automatic certificate creation when an enrollment becomes complete.
- Automatic certificate removal if a previously completed enrollment becomes incomplete.
- The same serial value displayed as both Certificate Number and Unique ID Number, as requested.
- A reusable fixed A4 portrait React certificate template.
- A protected server-side Playwright PDF endpoint for a student's own certificate.
- Public certificate verification by certificate serial.
- Print/PDF styling that is independent of application dark/light mode.

## 2. Architecture overview

```text
Course builder -> Authoring API -> Prisma Course
                                      |
                                      | ISO Standard + generated courseNumber
                                      v
Student enrollment -> lesson/quiz progress -> completion recomputation
                                                |
                                                v
                                      Certificate issuance service
                                                |
                                                v
                                      Prisma Certificate
                                      (serial + course snapshot)
                                                |
                 +------------------------------+------------------------------+
                 |                                                             |
                 v                                                             v
       Public verification by serial                              Authenticated PDF download
       GET /api/certificates/:serial                               GET /api/certificates/me/:certificateId/pdf
                 |                                                             |
                 v                                                             v
       verification response                              Playwright -> print page -> PDF
                                                               |
                                                               v
                                                     CertificateTemplate + background asset
```

## 3. Data model and ownership

### Course

The existing `Course` model was extended with `isoStandard String @default("")` and `courseNumber String @unique`. New course creation generates a value in the format `CRS-XXXXXXXXXXXX`; the suffix is derived from a UUID with hyphens removed and uppercased. Existing courses are backfilled by migration using a deterministic value derived from their database ID.

### Enrollment and completion

The existing `Enrollment`, `LessonProgress`, and quiz/progress logic remain the source of truth for completion. Certificate issuance is triggered by the existing enrollment recomputation path rather than by the React frontend.

### Certificate

The existing `Certificate` model is reused:

| Field | Purpose |
| --- | --- |
| `id` | Internal Prisma CUID used by protected internal lookup. |
| `enrollmentId` | Unique link to the enrollment. |
| `serial` | Public certificate number and unique ID shown on the certificate. |
| `learnerName` | Name snapshot stored when issued. |
| `courseNumber` | Course-number snapshot stored when issued. |
| `pdfUrl` | Existing optional storage field; new PDFs are not persisted. |
| `issuedAt` | Certificate issue timestamp. |

The course number is copied onto the certificate so the certificate retains the identifier that existed at issuance.

## 4. Course creation and ISO Standard flow

1. An instructor or administrator opens the course builder.
2. The ISO Standard field presents predefined options from the shared authoring contract.
3. Selecting `Other` reveals a text input.
4. The manually entered value is submitted as `isoStandard`.
5. The shared create/update schema validates the field.
6. The authoring service persists `isoStandard` on `Course`.
7. On course creation, the authoring service creates a unique `courseNumber`.
8. Course summary/detail mappers expose both values to the frontend.

The ISO value is optional for compatibility with existing courses, but when present it is included in certificate verification data and the certificate template.

## 5. Certificate issuance flow

1. A learner completes lessons and required quizzes through the existing enrollment flow.
2. The enrollment service recomputes completion after progress changes.
3. When complete, `manageCertificate` loads the learner and course number.
4. If no certificate exists, it creates one with a generated `CERT-XXXXXXXXXXXX` serial, learner-name snapshot, course-number snapshot, and enrollment ID.
5. If a certificate already exists, it is updated as needed rather than duplicated.
6. If the enrollment is no longer complete, the certificate is removed by the existing reconciliation behavior.

Because `enrollmentId` and `serial` are unique, one enrollment cannot receive duplicate certificates through this path.

## 6. Identifier rules

- Certificate Number = `Certificate.serial`.
- Unique ID Number = `Certificate.serial`.
- Course Number = `Course.courseNumber`, snapshotted to `Certificate.courseNumber`.
- Internal certificate ID = `Certificate.id`; this is not displayed as the Unique ID.

## 7. Public verification flow

The public endpoint is `GET /api/certificates/:serial`. It looks up the certificate by serial and returns validity, serial, learner name, course title/slug, unique ID equal to serial, course number, enrollment start date, completion date with issue-date fallback, issue date, ISO Standard, and verification URL.

The print page uses this endpoint through the server API client and does not query Prisma directly.

## 8. Authenticated PDF download flow

The protected endpoint is `GET /api/certificates/me/:certificateId/pdf`.

The controller obtains the authenticated user and passes both the certificate ID and user ID to `CertificatePdfService`. Authorization is enforced by a repository query requiring both `certificate.id = requested certificate ID` and `certificate.enrollment.userId = authenticated user ID`. Changing the ID therefore cannot expose another learner's certificate. Missing or unauthorized certificates are handled as not found.

The API returns an in-memory PDF with `Content-Type: application/pdf`, private/no-store caching, an attachment filename, and no permanent PDF storage.

## 9. Server-side PDF generation

`CertificatePdfService` loads the certificate and related data through Prisma, confirms ownership, launches Playwright Chromium, opens `${FRONTEND_URL}/certificates/${serial}/print`, waits for `.certificate-template` and document fonts, emulates print media, generates the PDF, returns the buffer, and closes the browser in a `finally` block.

PDF configuration is A4 portrait, `printBackground: true`, `displayHeaderFooter: false`, `preferCSSPageSize: true`, zero margins, and `pageRanges: 1`. The print route and CSS also define an A4 portrait page with hidden overflow, keeping the result to one page.

## 10. React certificate template

`CertificateTemplate` is a reusable presentational component. It receives one `CertificateTemplateData` object and contains no Prisma queries or authentication logic.

```ts
type CertificateTemplateData = {
  studentName: string;
  courseName: string;
  certificateNumber: string;
  uniqueId: string;
  courseNumber: string;
  courseStartDate: string;
  courseEndDate: string;
  issueDate: string;
  verificationUrl: string;
  isoStandard?: string;
};
```

The supplied artwork is used as a static background because it contains the exact client logos, badge, separator, watermark, signature, issuer details, footer, and QR-code position. The dynamic overlay contains the heading, certification text, student name, completion statement, ISO Standard, course name, certification statement, metadata rows, and validity statement.

Long student, ISO, and course names use a fitting helper that reduces font size within defined bounds. Fixed-width containers, no-wrap behavior, and overflow protection keep long values inside their allocated areas.

The template is fixed at `210mm x 297mm`. CSS locks it to the light reference design with `color-scheme: light`, explicit colors, isolation, print-color-adjust, and font-synthesis/text-rendering settings. Application dark/light mode therefore does not alter the certificate.

## 11. Frontend preview and print route

`/certificates/[serial]/print` fetches public verification data, formats dates as `MM/DD/YYYY`, maps the serial to both visible identifier fields, passes ISO Standard and course number to `CertificateTemplate`, and applies print-page CSS.

The student dashboard also renders the same template. Its existing print/download interaction opens the print route, while the API endpoint provides the authenticated server-side attachment download.

## 12. Certificate-related file inventory

### Modified files

| File | Change |
| --- | --- |
| `apps/api/package.json` | Added Playwright dependency. |
| `apps/api/prisma/schema.prisma` | Added ISO Standard, unique course number, and certificate course-number snapshot. |
| `apps/api/src/config/env.ts` | Added optional Playwright executable path. |
| `apps/api/src/modules/authoring/authoring.service.ts` | Saves ISO Standard and generates course numbers. |
| `apps/api/src/modules/certificates/certificates.controller.ts` | Added authenticated PDF-download route. |
| `apps/api/src/modules/certificates/certificates.module.ts` | Registers PDF generation service. |
| `apps/api/src/modules/certificates/certificates.repository.ts` | Added ownership lookup and related certificate data. |
| `apps/api/src/modules/certificates/certificates.service.ts` | Returns ISO/course data and serial-based unique ID. |
| `apps/api/src/modules/courses/course.mapper.ts` | Exposes ISO Standard and course number. |
| `apps/api/src/modules/enrollment/enrollment.repository.ts` | Reads course number and persists it on certificates. |
| `apps/api/src/modules/enrollment/enrollment.service.ts` | Passes course number into certificate issuance. |
| `apps/web/app/globals.css` | Added fixed A4 certificate and print/PDF styling. |
| `apps/web/app/certificates/[serial]/print/page.tsx` | Renders the print page from verification data. |
| `apps/web/app/(student)/dashboard/certificates/page-client.tsx` | Uses the shared template and maps certificate data. |
| `apps/web/lib/api/endpoints.ts` | Added certificate course-number typing. |
| `apps/web/components/shared/course-builder.tsx` | Added ISO selection and custom `Other` input. |
| `packages/shared/src/contracts/authoring.ts` | Added ISO options and validation. |
| `packages/shared/src/contracts/catalog.ts` | Added ISO and course-number contracts. |
| `packages/shared/src/contracts/enrollment.ts` | Added course number to certificate DTO. |
| `railpack.api.json` | Installs Chromium during API image build. |
| `pnpm-lock.yaml` | Lockfile update for Playwright. |

### Created files

| File | Purpose |
| --- | --- |
| `apps/api/prisma/migrations/20260903100000_add_iso_standard_to_course/migration.sql` | Adds ISO Standard to courses. |
| `apps/api/prisma/migrations/20260903120000_add_course_number/migration.sql` | Adds, backfills, and uniquely indexes course numbers. |
| `apps/api/prisma/migrations/20260903123000_snapshot_course_number_on_certificate/migration.sql` | Adds and backfills certificate course-number snapshots. |
| `apps/api/src/modules/certificates/certificate-pdf.service.ts` | Generates authorized one-page PDFs with Playwright. |
| `apps/web/components/shared/certificate-template.tsx` | Reusable certificate React template. |
| `apps/web/public/certificate/client-background.jpg` | Static artwork extracted from the supplied client PDF. |

### Deleted file

| File | Reason |
| --- | --- |
| `apps/web/components/shared/certificate-preview.tsx` | Removed redundant preview adapter; the dashboard uses the single shared template. |

## 13. Existing and required dependencies

Existing dependencies include Prisma, the existing NestJS API/authentication modules, Next.js, and PDFKit. PDFKit remains used by the older public PDF utility.

The new certificate path adds `playwright` to `apps/api`. No QR-code dependency was added because the QR code is embedded in the supplied static artwork. Deployment installs Chromium through Railpack. Locally:

```powershell
pnpm --filter @skillstream/api exec playwright install chromium
```

`PLAYWRIGHT_EXECUTABLE_PATH` may be set when Chromium is installed at a non-default location.

## 14. Database migration and local setup

Apply migrations with `pnpm --filter @skillstream/api prisma:deploy`, install Chromium with the command above, then run the API and web applications using the repository's normal development commands. The API `FRONTEND_URL` must point to the web application because Playwright loads the frontend print route.

## 15. Testing locally

Open `/certificates/<serial>/print` in a browser, inspect the certificate, and use Save as PDF. For the protected API, use an authenticated token:

```powershell
curl.exe -H "Authorization: Bearer <token>" `
  -o certificate.pdf `
  http://localhost:<api-port>/api/certificates/me/<certificate-id>/pdf
```

Verify one A4 portrait page, visible artwork, non-overlapping fonts, correct student/course/ISO text, identical Certificate Number and Unique ID Number, ownership protection, and certificate removal after completion is revoked.

## 16. Validation completed

Passed checks during implementation: shared package build; API and web typechecks; API and web builds; Prisma client generation and schema validation; and `git diff --check` for certificate changes.

The protected PDF endpoint was not exercised against a live local Chromium instance when Chromium was absent from the local Playwright cache. Deployment installs Chromium during the API image build; local runtime testing requires the install command above.

## 17. Current limitations and future options

- `GET /api/certificates/:serial/pdf` is the pre-existing public PDFKit path; the new protected route uses Playwright and the React template. They are separate paths and may not be pixel-identical until the legacy path is migrated.
- The QR code is static because it is embedded in the client-supplied background artwork. The visible verification URL is dynamic. A future per-certificate QR requirement would need QR generation and template compositing.
- Course numbers are generated by the authoring create flow; the migration backfills older courses.
- Replacing the client artwork requires a new approved asset and coordinate review.

## 18. End-to-end summary

An instructor/admin creates a course, chooses or manually enters an ISO Standard, and receives a generated course number. A learner completes the course. The enrollment service detects completion and creates one certificate containing the learner name, serial, and course-number snapshot. Public verification resolves that serial without authentication. For a private download, the authenticated learner supplies the internal certificate ID; the API verifies ownership, Playwright loads the print page, and the server returns a one-page A4 PDF rendered from the shared certificate template.

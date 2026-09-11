# Frontend Modification Notes

## Certificate PDF download

The dashboard certificate preview and downloaded PDF now use the same certificate composition. The dashboard buttons call the authenticated endpoint:

- `GET /api/certificates/me/:serial/pdf`
- The certificate is looked up by its public serial and authenticated user ownership is verified.
- The endpoint is throttled to 10 requests per minute.
- The API uses Playwright/Chromium to load `/certificates/:serial/print`, which renders the shared `CertificateTemplate`.
- The PDF is generated as a single A4 portrait page with print backgrounds enabled.
- The browser downloads the returned PDF as `skillstream-certificate-<serial>.pdf`.

## Frontend files involved

- `apps/web/app/(student)/dashboard/certificates/page-client.tsx` — dashboard download buttons and certificate data mapping.
- `apps/web/components/shared/certificate-template.tsx` — shared certificate artwork and dynamic fields.
- `apps/web/app/certificates/[serial]/print/page.tsx` — print/PDF rendering route.
- `apps/web/lib/api/client.ts` — cookie-authenticated binary download helper.
- `apps/web/app/api/[...path]/route.ts` — frontend API proxy that forwards cookies and PDF responses.

## API files involved

- `apps/api/src/modules/certificates/certificates.controller.ts` — authenticated serial endpoint, response headers, and throttling.
- `apps/api/src/modules/certificates/certificates.repository.ts` — serial plus user ownership lookup.
- `apps/api/src/modules/certificates/certificate-pdf.service.ts` — Playwright browser lifecycle and PDF generation.
- `apps/api/src/modules/certificates/certificates.service.ts` — certificate lookup and renderer delegation.
- `apps/api/src/modules/certificates/certificates.module.ts` — renderer registration.
- `apps/api/package.json` and `pnpm-lock.yaml` — Playwright dependency.
- `railpack.api.json` — Chromium installation during deployment.

## Runtime requirements

Local development requires the Playwright Chromium binary:

- `pnpm --filter @skillstream/api exec playwright install chromium`
- `FRONTEND_URL` must point to the running web app.
- `API_ORIGIN` must be configured for the web server when the API is not at `http://localhost:4000`.

## Verification completed

- API production build passes.
- Frontend typecheck passes.
- Certificate service tests pass.
- A real public certificate PDF request returned HTTP 200 with a valid `%PDF` signature.
- The authenticated endpoint returns HTTP 401 when no session is supplied.
- The browser download helper keeps the blob URL alive until the download is queued.

## Troubleshooting

If the dashboard shows a generic download error, restart the API from the current workspace after rebuilding it, confirm port 4000 is serving the current process, and verify that Chromium is installed.

# Email Service — Provider-Agnostic Refactor Plan

## Goal

- Use **Resend** now.
- Swap provider (SES, Postmark, SendGrid, SMTP, Mailgun…) later by adding one adapter file + flipping an env var. No changes to callers.
- Any Nest module can inject and send email today (already `@Global()`).

## Current state (baseline)

- `apps/api/src/modules/email/email.module.ts` — `@Global()`, exports `EmailService`. Every module can inject already.
- `apps/api/src/modules/email/email.service.ts` — mixes two concerns:
  - **Transport**: instantiates `new Resend(apiKey)`, calls `resend.emails.send(...)`.
  - **Templates + call-site helpers**: `sendPasswordReset`, `sendOrgInvite`, `sendReminder`, `sendNotificationEmail`, `sendWelcome`, `sendApplicationDecision`, `sendReceipt`, `sendAdminAlert` + inline HTML builders.
- Env keys: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `FRONTEND_URL` (see `apps/api/src/config/env.ts:69,74,75`).
- Consumers: many modules already call `EmailService` directly (auth, notifications, organizations, commerce, sales-agent, instructor, admin-alerts, etc). Keep their public API unchanged.

## Target architecture

Split into three layers:

```
callers  →  EmailService (templates + helpers)  →  EmailProvider (transport interface)  →  ResendProvider (adapter)
                                                                                       ↘  LogProvider (dev/no-key fallback)
                                                                                       ↘  future: SesProvider, SmtpProvider…
```

### 1. `EmailProvider` interface (transport-only)

```ts
// apps/api/src/modules/email/providers/email-provider.ts
export interface EmailAttachment {
  filename: string;
  content: Buffer | string; // base64 or raw
  contentType?: string;
}

export interface SendEmailInput {
  to: string | string[];
  from?: string;         // defaults to configured "from"
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
  tags?: Record<string, string>; // for provider analytics; providers may ignore
  headers?: Record<string, string>;
}

export interface SendEmailResult {
  id?: string;           // provider message id when available
}

export const EMAIL_PROVIDER = Symbol("EMAIL_PROVIDER");

export interface EmailProvider {
  send(input: SendEmailInput): Promise<SendEmailResult>;
}
```

Injection token pattern (`EMAIL_PROVIDER` symbol) — keeps `EmailService` decoupled from the concrete class.

### 2. Adapters

- `providers/resend.provider.ts`
  - Wraps `new Resend(apiKey)`.
  - Maps `SendEmailInput` → `resend.emails.send({...})`.
  - Maps attachments (`Buffer.toString("base64")`) and throws on `{ error }`.
- `providers/log.provider.ts`
  - No-op that `this.logger.log(...)`s the outbound email. Used when driver is `log` or when the selected driver is missing credentials in dev.
- Future adapters (`ses.provider.ts`, `smtp.provider.ts`, `postmark.provider.ts`) implement the same interface. **Zero caller changes.**

### 3. Factory / DI wiring

`email.module.ts` provides `EMAIL_PROVIDER` via factory:

```ts
{
  provide: EMAIL_PROVIDER,
  inject: [ConfigService],
  useFactory: (config: ConfigService<Env, true>): EmailProvider => {
    const driver = config.get("EMAIL_DRIVER", { infer: true });
    switch (driver) {
      case "resend": return new ResendProvider(config);
      case "log":    return new LogProvider();
      // case "ses":  return new SesProvider(config);
      default:       return new LogProvider();
    }
  },
}
```

`EmailService` constructor becomes:

```ts
constructor(
  @Inject(EMAIL_PROVIDER) private readonly provider: EmailProvider,
  private readonly config: ConfigService<Env, true>,
) { ... }
```

Every `sendPasswordReset` / `sendReceipt` / etc. body changes from:

```ts
await this.resend.emails.send({ from, to, subject, html, text, attachments });
```

to:

```ts
await this.provider.send({ to, subject, html, text, attachments });
```

Templates (`passwordResetHtml`, `orgInviteHtml`, `reminderHtml`, `notificationHtml`, `welcomeHtml`, `adminAlertHtml`) stay in `EmailService` untouched.

The `[DEV] ... would be sent` log branches disappear — `LogProvider` handles that concern once, for every method.

### 4. Env changes (`apps/api/src/config/env.ts`)

Add:

```ts
EMAIL_DRIVER: z.enum(["resend", "log"]).optional(), // resolves per NODE_ENV below
EMAIL_FROM: z.string().email().default("noreply@grslearning.dev"),
EMAIL_REPLY_TO: z.string().email().optional(),
```

Resolution rule in the `.transform` step: default `EMAIL_DRIVER` to `resend` when `RESEND_API_KEY` set, else `log`.

`superRefine` guard: when `EMAIL_DRIVER === "resend"`, require `RESEND_API_KEY`. Mirrors the `STORAGE_DRIVER=s3` pattern already used in the file.

Deprecate (keep parsing, remove later): `RESEND_FROM_EMAIL` → `EMAIL_FROM`. Add a fallback so existing deployments keep booting: `EMAIL_FROM ?? RESEND_FROM_EMAIL`.

### 5. Directory layout after refactor

```
apps/api/src/modules/email/
├── email.module.ts                  # wires EMAIL_PROVIDER factory
├── email.service.ts                 # templates + high-level helpers (unchanged public API)
├── providers/
│   ├── email-provider.ts            # interface + EMAIL_PROVIDER token + DTOs
│   ├── resend.provider.ts           # Resend adapter
│   └── log.provider.ts              # dev/no-key adapter
├── admin-alerts.service.ts          # unchanged
├── admin-alerts.repository.ts       # unchanged
├── sms.service.ts                   # unchanged (SMS is a separate concern, not touched)
└── __tests__/…
```

## Cross-module usage pattern

`EmailModule` remains `@Global()`, so **any** module can:

```ts
import { EmailService } from "../email/email.service";

@Injectable()
export class SomeService {
  constructor(private readonly email: EmailService) {}
  async notify(user: User) {
    await this.email.sendWelcome(user.email, user.name);
  }
}
```

For one-off transactional emails without a helper, callers may also inject `EMAIL_PROVIDER` directly, but the preferred entry point is `EmailService` so templates stay centralised.

### Adding a new email

1. Add a template method + helper to `EmailService` (e.g. `sendInvoicePastDue(...)`).
2. Inject `EmailService` from the consumer module.
3. Provider stays untouched.

## Swapping providers later (contract of this refactor)

To switch from Resend to, say, AWS SES:

1. `pnpm add @aws-sdk/client-sesv2` in `apps/api`.
2. Create `providers/ses.provider.ts` implementing `EmailProvider`.
3. Extend `EMAIL_DRIVER` enum with `"ses"` and add adapter branch in the factory.
4. Set `EMAIL_DRIVER=ses` + SES env vars in the deployment.
5. **No caller-side change. No template change.**

## Testing plan

- `providers/__tests__/resend.provider.test.ts` — mocks `resend` SDK; asserts payload mapping (from, attachments base64, error propagation).
- `providers/__tests__/log.provider.test.ts` — asserts logs, no throw, returns `{ id: undefined }`.
- `email.service.test.ts` — inject a fake `EmailProvider` (in-memory spy); assert each helper produces expected `SendEmailInput` (subject, recipients, template contents). This is the biggest win: tests stop caring about Resend.
- Wire smoke test: `EMAIL_DRIVER=log` in `NODE_ENV=test`, ensure boot works with no `RESEND_API_KEY`.

## Migration steps (PR-sized commits)

1. **Introduce interface + adapters + factory** (no behavior change). `EmailService` still directly uses Resend; wire `EMAIL_PROVIDER` alongside, unused.
2. **Cut `EmailService` over** to `this.provider.send(...)`; delete Resend import + `[DEV]` branches from `email.service.ts`. Callers unaffected.
3. **Env cleanup**: add `EMAIL_DRIVER`, `EMAIL_FROM`, `EMAIL_REPLY_TO`; keep `RESEND_FROM_EMAIL` fallback. Update `.env.example` + Railway/staging envs.
4. **Delete deprecated env aliases** (`RESEND_FROM_EMAIL`) once all envs migrated.

## Non-goals

- No queueing/retry layer in this pass. If needed later, wrap `EmailProvider` with a BullMQ-backed decorator — the interface already supports that transparently.
- No template engine migration (MJML / react-email). Templates stay as inline HTML strings; swappable later without touching transport.
- SMS (`sms.service.ts`) stays as-is; same interface pattern can be applied separately if Twilio needs to be swapped.

## Risks

- Behavior parity between `Resend` error shape (`{ error }`) and the interface's throw contract — cover with tests.
- Attachment encoding: Resend expects base64 string; new interface accepts `Buffer | string`. Adapter must handle both.
- Env drift: staging/prod must set `EMAIL_DRIVER=resend` explicitly once default flips, or rely on the `RESEND_API_KEY`-present heuristic.

## Deliverables checklist

- [ ] `providers/email-provider.ts` (interface + token + DTOs)
- [ ] `providers/resend.provider.ts`
- [ ] `providers/log.provider.ts`
- [ ] `email.module.ts` factory-wired
- [ ] `email.service.ts` uses `EMAIL_PROVIDER`, no Resend import
- [ ] `env.ts` new keys + superRefine
- [ ] `.env.example` updated
- [ ] Tests: provider adapters + `EmailService` with fake provider

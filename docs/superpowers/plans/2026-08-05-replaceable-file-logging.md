# Replaceable File Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Nest-compatible Pino logger that writes readable console plus daily JSON files in development, structured stdout only in production, and hides replaceable destinations behind internal interfaces.

**Architecture:** A global `LoggingModule` builds a `LoggingRuntime` from validated configuration and exposes only a Nest `LoggerService` to the application. Internal destination implementations provide stdout or UTC-rotated files; the composition layer adds development pretty output, structured records, redaction, request correlation, and lifecycle cleanup.

**Tech Stack:** NestJS 11, TypeScript 5, Pino, `pino-pretty`, Node.js streams/filesystem, Zod, Vitest

## Global Constraints

- Application services use only Nest's `Logger`/`LoggerService`; no service imports Pino or destination APIs.
- Development defaults to readable console output plus `logs/logger-YYYY-MM-DD.log`.
- Production writes structured JSON Lines to stdout only and rejects `LOG_DESTINATION=file`.
- Daily filenames and retention calculations use UTC.
- File retention defaults to exactly 14 days.
- Unsupported destinations fail validation; do not add nonfunctional Loki or OpenTelemetry stubs.
- Request bodies are not logged automatically.
- Logging initialization failures are visible and never silently disable the configured destination.
- Preserve the user's existing uncommitted `apps/api/src/config/env.ts` change for blank `PUBLIC_API_URL`.

---

## File Structure

Create the following focused logging units:

- `apps/api/src/logging/logging.types.ts` — internal destination/runtime contracts and configuration types.
- `apps/api/src/logging/file.destination.ts` — UTC daily file stream and 14-day cleanup.
- `apps/api/src/logging/destination.factory.ts` — selects `file` or `stdout`; rejects invalid environment combinations.
- `apps/api/src/logging/redaction.ts` — the single sensitive-field redaction policy.
- `apps/api/src/logging/nest-pino.logger.ts` — Nest `LoggerService` adapter over a Pino instance.
- `apps/api/src/logging/logging.runtime.ts` — composes destination, console formatting, Pino, and shutdown.
- `apps/api/src/logging/logging.module.ts` — global Nest providers and lifecycle ownership.
- `apps/api/src/logging/request-logging.middleware.ts` — request ID and one completion record per HTTP request.
- `apps/api/src/logging/__tests__/*.test.ts` — deterministic unit/integration tests using temporary directories and memory streams.

Modify:

- `apps/api/src/config/env.ts` and `apps/api/.env.example` — validated logging settings.
- `apps/api/src/app.module.ts` — import logging and apply request middleware.
- `apps/api/src/main.ts` — buffer bootstrap logs, install global adapter, flush, and remove direct console logging.
- `apps/api/package.json` and `pnpm-lock.yaml` — add Pino runtime and pretty development dependencies.
- `.gitignore` — exclude runtime logs.

---

### Task 1: Validate Logging Configuration

**Files:**
- Modify: `apps/api/src/config/env.ts`
- Modify: `apps/api/.env.example`
- Create: `apps/api/src/logging/__tests__/logging-env.test.ts`

**Interfaces:**
- Produces: `Env["LOG_DESTINATION"]` as `"file" | "stdout"`
- Produces: `Env["LOG_LEVEL"]` as `"fatal" | "error" | "warn" | "info" | "debug" | "trace"`
- Produces: `Env["LOG_DIR"]` as `string`
- Produces: `Env["LOG_RETENTION_DAYS"]` as `number`
- Preserves: the existing `optionalUrl` preprocessing for `PUBLIC_API_URL`

- [ ] **Step 1: Write failing configuration tests**

Create `apps/api/src/logging/__tests__/logging-env.test.ts` with a valid base
environment and these assertions:

```ts
import { describe, expect, it } from "vitest";
import { validateEnv } from "../../config/env";

const base = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  JWT_ACCESS_SECRET: "0123456789abcdef",
};

describe("logging environment", () => {
  it("defaults development to file logging with 14-day retention", () => {
    const env = validateEnv({ ...base, NODE_ENV: "development" });
    expect(env).toMatchObject({
      LOG_DESTINATION: "file",
      LOG_LEVEL: "info",
      LOG_DIR: "logs",
      LOG_RETENTION_DAYS: 14,
    });
  });

  it("defaults production to stdout", () => {
    const env = validateEnv({ ...base, NODE_ENV: "production" });
    expect(env.LOG_DESTINATION).toBe("stdout");
  });

  it("rejects file logging in production", () => {
    expect(() =>
      validateEnv({
        ...base,
        NODE_ENV: "production",
        LOG_DESTINATION: "file",
      }),
    ).toThrow(/LOG_DESTINATION.*stdout/i);
  });

  it.each(["loki", "otel", "unknown"])(
    "rejects unsupported destination %s",
    (LOG_DESTINATION) => {
      expect(() => validateEnv({ ...base, LOG_DESTINATION })).toThrow(
        /LOG_DESTINATION/,
      );
    },
  );

  it("rejects nonpositive retention", () => {
    expect(() =>
      validateEnv({ ...base, LOG_RETENTION_DAYS: "0" }),
    ).toThrow(/LOG_RETENTION_DAYS/);
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm --filter @skillstream/api test -- src/logging/__tests__/logging-env.test.ts
```

Expected: FAIL because the four logging properties do not exist.

- [ ] **Step 3: Extend the environment schema without overwriting the existing URL fix**

Rename the current object declaration from `envSchema` to `rawEnvSchema`, insert
the four logging fields immediately before its closing brace, then add the
object-level transform/refinement below it. Do not rewrite or remove any
existing field:

```ts
const logLevelSchema = z.enum([
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
]);

// Insert these fields into the existing rawEnvSchema object.
LOG_DESTINATION: z.enum(["file", "stdout"]).optional(),
LOG_LEVEL: logLevelSchema.default("info"),
LOG_DIR: z.string().trim().min(1).default("logs"),
LOG_RETENTION_DAYS: z.coerce.number().int().positive().default(14),

export const envSchema = rawEnvSchema
  .transform((env) => ({
    ...env,
    LOG_DESTINATION:
      env.LOG_DESTINATION ??
      (env.NODE_ENV === "production" ? ("stdout" as const) : ("file" as const)),
  }))
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production" && env.LOG_DESTINATION === "file") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["LOG_DESTINATION"],
        message: "LOG_DESTINATION must be stdout in production",
      });
    }
  });
```

Keep `validateEnv()` and `Env = z.infer<typeof envSchema>` pointed at the
transformed schema. If Zod requires refinement before transform in the installed
version, apply `superRefine` to `rawEnvSchema` and compute the effective default
inside the refinement; retain the exact output type and behavior above.

Document the settings in `apps/api/.env.example`:

```dotenv
# Logging: development writes JSON Lines to this daily file and remains readable
# on the console. Production must use stdout and never creates a local log file.
LOG_DESTINATION=file
LOG_LEVEL=info
LOG_DIR=logs
LOG_RETENTION_DAYS=14
```

- [ ] **Step 4: Run focused tests and typecheck**

Run:

```bash
pnpm --filter @skillstream/api test -- src/logging/__tests__/logging-env.test.ts
pnpm --filter @skillstream/api typecheck
```

Expected: both commands exit 0.

- [ ] **Step 5: Commit the configuration contract**

```bash
git add apps/api/src/config/env.ts apps/api/.env.example apps/api/src/logging/__tests__/logging-env.test.ts
git commit -m "feat(api): validate logging configuration"
```

---

### Task 2: Implement the Replaceable Destination Contract and Daily File Destination

**Files:**
- Create: `apps/api/src/logging/logging.types.ts`
- Create: `apps/api/src/logging/file.destination.ts`
- Create: `apps/api/src/logging/destination.factory.ts`
- Create: `apps/api/src/logging/__tests__/file.destination.test.ts`
- Create: `apps/api/src/logging/__tests__/destination.factory.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `Env` from `apps/api/src/config/env.ts`
- Produces:

```ts
export interface LogDestination {
  readonly stream: NodeJS.WritableStream;
  readonly activeFile?: string;
  close(): Promise<void>;
}

export interface FileDestinationOptions {
  directory: string;
  retentionDays: number;
  now?: () => Date;
}

export function createFileDestination(
  options: FileDestinationOptions,
): Promise<LogDestination>;

export function createLogDestination(env: Env): Promise<LogDestination>;
```

- [ ] **Step 1: Write failing file destination tests**

Use `mkdtemp`, `tmpdir`, `readFile`, `readdir`, `stat`, and `writeFile` from
Node. Inject a mutable UTC clock. Cover:

```ts
it("writes JSON lines to logger-YYYY-MM-DD.log", async () => {
  const destination = await createFileDestination({
    directory,
    retentionDays: 14,
    now: () => new Date("2026-08-05T12:00:00.000Z"),
  });
  destination.stream.write('{"msg":"hello"}\n');
  await destination.close();
  expect(await readFile(join(directory, "logger-2026-08-05.log"), "utf8"))
    .toBe('{"msg":"hello"}\n');
});

it("rotates on the next UTC date before writing the next record", async () => {
  let now = new Date("2026-08-05T23:59:59.000Z");
  const destination = await createFileDestination({
    directory,
    retentionDays: 14,
    now: () => now,
  });
  destination.stream.write('{"day":5}\n');
  now = new Date("2026-08-06T00:00:01.000Z");
  destination.stream.write('{"day":6}\n');
  await destination.close();
  expect(await readdir(directory)).toEqual([
    "logger-2026-08-05.log",
    "logger-2026-08-06.log",
  ]);
});
```

Also assert that initialization/rotation removes `logger-2026-07-22.log`,
retains
`logger-2026-07-23.log`, and never deletes `notes.log` or malformed names.
Assert an unusable path rejects initialization.

- [ ] **Step 2: Run file tests and verify RED**

Run:

```bash
pnpm --filter @skillstream/api test -- src/logging/__tests__/file.destination.test.ts
```

Expected: FAIL because the destination files and exports do not exist.

- [ ] **Step 3: Implement the destination types and UTC filename helpers**

In `logging.types.ts`, define the interfaces above. In
`file.destination.ts`, keep these helpers module-private except where direct
testing materially improves clarity:

```ts
const FILE_PATTERN = /^logger-(\d{4}-\d{2}-\d{2})\.log$/;
const utcDate = (date: Date) => date.toISOString().slice(0, 10);
const filename = (date: Date) => `logger-${utcDate(date)}.log`;
```

Implement a `Writable` that owns the active `WriteStream`. Before every write,
compare `utcDate(now())` with the active date; if changed, close the prior
stream, open the new append-only stream, run cleanup, then write. Implement
`_final` to flush and close the active stream. Propagate open/write errors to
the caller instead of dropping records.

Cleanup must:

1. enumerate only names matching `FILE_PATTERN`;
2. parse the captured date as UTC;
3. compute the oldest retained UTC date as the active date minus
   `retentionDays - 1` days, then remove matching files dated before that
   cutoff (14 retains the active date plus the preceding 13 dates);
4. leave the active file, recent files, directories, and unrelated names alone.

- [ ] **Step 4: Run file tests and verify GREEN**

Run:

```bash
pnpm --filter @skillstream/api test -- src/logging/__tests__/file.destination.test.ts
```

Expected: all file destination tests pass.

- [ ] **Step 5: Write failing factory tests**

Create `destination.factory.test.ts`:

```ts
it("returns stdout without creating LOG_DIR", async () => {
  const env = validEnv({
    NODE_ENV: "production",
    LOG_DESTINATION: "stdout",
    LOG_DIR: directory,
  });
  const destination = await createLogDestination(env);
  expect(destination.stream).toBe(process.stdout);
  expect(await pathExists(directory)).toBe(false);
  await destination.close();
});

it("creates the file destination in development", async () => {
  const env = validEnv({
    NODE_ENV: "development",
    LOG_DESTINATION: "file",
    LOG_DIR: directory,
  });
  const destination = await createLogDestination(env);
  expect(destination.activeFile).toMatch(/logger-\d{4}-\d{2}-\d{2}\.log$/);
  await destination.close();
});
```

- [ ] **Step 6: Implement the factory and ignore runtime logs**

`createLogDestination(env)` switches exhaustively on
`env.LOG_DESTINATION`. The stdout implementation returns `process.stdout` and
a no-op `close()` that must never close stdout. The file branch calls
`createFileDestination`. Use an exhaustive `never` assertion for future
destination additions.

Append to `.gitignore`:

```gitignore
# application logs
logs/
*.log
```

- [ ] **Step 7: Verify destination tests and typecheck**

Run:

```bash
pnpm --filter @skillstream/api test -- src/logging/__tests__/file.destination.test.ts src/logging/__tests__/destination.factory.test.ts
pnpm --filter @skillstream/api typecheck
```

Expected: both commands exit 0.

- [ ] **Step 8: Commit destination infrastructure**

```bash
git add .gitignore apps/api/src/logging/logging.types.ts apps/api/src/logging/file.destination.ts apps/api/src/logging/destination.factory.ts apps/api/src/logging/__tests__/file.destination.test.ts apps/api/src/logging/__tests__/destination.factory.test.ts
git commit -m "feat(api): add replaceable daily log destination"
```

---

### Task 3: Build the Pino-to-Nest Adapter and Logging Runtime

**Files:**
- Modify: `apps/api/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `apps/api/src/logging/redaction.ts`
- Create: `apps/api/src/logging/nest-pino.logger.ts`
- Create: `apps/api/src/logging/logging.runtime.ts`
- Create: `apps/api/src/logging/__tests__/nest-pino.logger.test.ts`
- Create: `apps/api/src/logging/__tests__/logging.runtime.test.ts`

**Interfaces:**
- Consumes: `LogDestination`, `createLogDestination(env)`, and `Env`
- Produces:

```ts
export const REDACT_PATHS: readonly string[];

export class NestPinoLogger implements LoggerService {
  constructor(private readonly logger: pino.Logger);
  log(message: unknown, ...optionalParams: unknown[]): void;
  error(message: unknown, ...optionalParams: unknown[]): void;
  warn(message: unknown, ...optionalParams: unknown[]): void;
  debug(message: unknown, ...optionalParams: unknown[]): void;
  verbose(message: unknown, ...optionalParams: unknown[]): void;
  fatal(message: unknown, ...optionalParams: unknown[]): void;
}

export interface LoggingRuntime {
  logger: LoggerService;
  close(): Promise<void>;
}

export function createLoggingRuntime(env: Env): Promise<LoggingRuntime>;
```

- [ ] **Step 1: Install the minimal logging dependencies**

Run:

```bash
pnpm --filter @skillstream/api add pino
pnpm --filter @skillstream/api add pino-pretty
```

Do not add `nestjs-pino` or `pino-http`; the application-owned Nest adapter and
middleware provide the required boundaries. Keep `pino-pretty` in runtime
dependencies because the production module graph imports the runtime factory
even though production selects stdout.

- [ ] **Step 2: Write failing adapter and redaction tests**

Use a memory `Writable` to capture Pino output. Assert:

- every Nest level maps to the matching Pino level (`verbose` maps to `trace`);
- a final string optional parameter is emitted as `context`;
- `error("failed", stack, "UsersService")` preserves `stack` and `context`;
- an `Error` passed as the message is serialized with name, message, and stack;
- object messages remain structured rather than becoming `"[object Object]"`;
- fields named `authorization`, `cookie`, `password`, `accessToken`,
  `refreshToken`, `apiKey`, `clientSecret`, `signingKey`, and `webhookSecret`
  are emitted as `[Redacted]`.

Example assertion:

```ts
logger.error("query failed", "Error: boom\n at test", "UsersService");
const record = records()[0];
expect(record).toMatchObject({
  level: 50,
  msg: "query failed",
  context: "UsersService",
  stack: expect.stringContaining("Error: boom"),
});
```

- [ ] **Step 3: Run adapter tests and verify RED**

Run:

```bash
pnpm --filter @skillstream/api test -- src/logging/__tests__/nest-pino.logger.test.ts
```

Expected: FAIL because adapter and redaction modules do not exist.

- [ ] **Step 4: Implement redaction and the Nest adapter**

Centralize Pino paths in `redaction.ts`. Include root and nested forms needed by
HTTP records, for example:

```ts
export const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "res.headers.set-cookie",
  "authorization",
  "cookie",
  "password",
  "passwordConfirmation",
  "accessToken",
  "refreshToken",
  "apiKey",
  "clientSecret",
  "signingKey",
  "webhookSecret",
  "*.password",
  "*.accessToken",
  "*.refreshToken",
] as const;
```

`NestPinoLogger` must normalize Nest's optional `context` and error stack
without mutating caller objects. Use Pino's standard error serializer for
`Error` instances.

- [ ] **Step 5: Write failing runtime tests**

Inject destination and console stream factories into an internal
`createLoggingRuntime` options parameter so tests avoid process streams:

```ts
const runtime = await createLoggingRuntime(devEnv, {
  createDestination: async () => fileDestination,
  consoleStream: prettyCapture,
});
runtime.logger.log({ event: "ready", password: "secret" }, "Bootstrap");
await runtime.close();
```

Assert development writes one logical record to both console and file;
production writes only to the stdout destination; both outputs redact the
password; and `close()` closes the configured destination exactly once.

- [ ] **Step 6: Implement runtime composition**

Create the Pino root with:

```ts
pino(
  {
    level: env.LOG_LEVEL,
    base: { service: "@skillstream/api", environment: env.NODE_ENV },
    redact: { paths: [...REDACT_PATHS], censor: "[Redacted]" },
    serializers: { err: pino.stdSerializers.err },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  output,
);
```

For development, `output` is `pino.multistream()` containing a
`pino-pretty` stream and the file destination. For production, it is only the
stdout destination. Make `close()` idempotent and ensure it flushes Pino before
closing the destination.

- [ ] **Step 7: Verify adapter/runtime tests and typecheck**

Run:

```bash
pnpm --filter @skillstream/api test -- src/logging/__tests__/nest-pino.logger.test.ts src/logging/__tests__/logging.runtime.test.ts
pnpm --filter @skillstream/api typecheck
```

Expected: both commands exit 0.

- [ ] **Step 8: Commit the logger engine**

```bash
git add apps/api/package.json pnpm-lock.yaml apps/api/src/logging/redaction.ts apps/api/src/logging/nest-pino.logger.ts apps/api/src/logging/logging.runtime.ts apps/api/src/logging/__tests__/nest-pino.logger.test.ts apps/api/src/logging/__tests__/logging.runtime.test.ts
git commit -m "feat(api): add Nest-compatible Pino runtime"
```

---

### Task 4: Own Runtime Lifecycle in a Global Logging Module

**Files:**
- Create: `apps/api/src/logging/logging.constants.ts`
- Create: `apps/api/src/logging/logging.module.ts`
- Create: `apps/api/src/logging/__tests__/logging.module.test.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/main.ts`

**Interfaces:**
- Consumes: `createLoggingRuntime(env)` and `LoggingRuntime`
- Produces:

```ts
export const APP_LOGGER = Symbol("APP_LOGGER");

@Global()
@Module({})
export class LoggingModule {}
```

- [ ] **Step 1: Write a failing logging module lifecycle test**

Build a Nest testing module with `ConfigModule` and `LoggingModule`. Override
the runtime factory/provider with a fake runtime, then assert:

```ts
expect(moduleRef.get<LoggerService>(APP_LOGGER)).toBe(fakeRuntime.logger);
await moduleRef.close();
expect(fakeRuntime.close).toHaveBeenCalledOnce();
```

Also compile `AppModule` far enough to assert `APP_LOGGER` is resolvable
globally without importing logging internals into a feature module.

- [ ] **Step 2: Run the module test and verify RED**

Run:

```bash
pnpm --filter @skillstream/api test -- src/logging/__tests__/logging.module.test.ts
```

Expected: FAIL because `LoggingModule` and `APP_LOGGER` do not exist.

- [ ] **Step 3: Implement the module and lifecycle provider**

Register an async runtime provider using `ConfigService<Env, true>`. Alias
`APP_LOGGER` to `runtime.logger`. Add a focused injectable lifecycle owner that
implements `OnApplicationShutdown` and calls `runtime.close()`. Mark the module
global and export only `APP_LOGGER`, not the Pino instance or destination.

Import `LoggingModule` in `AppModule` immediately after `ConfigModule`.

- [ ] **Step 4: Install the adapter during bootstrap**

Change `main.ts` to:

```ts
const app = await NestFactory.create(AppModule, {
  bufferLogs: true,
  rawBody: true,
});
app.useLogger(app.get<LoggerService>(APP_LOGGER));
app.flushLogs();
app.enableShutdownHooks();
```

Replace the final `console.log` with:

```ts
const logger = new Logger("Bootstrap");
logger.log(`API listening on http://localhost:${port} (docs at /docs)`);
```

Replace any remaining bootstrap `console.warn/error` with Nest `Logger` calls
so they flow through the adapter.

- [ ] **Step 5: Verify module tests, existing exception tests, and typecheck**

Run:

```bash
pnpm --filter @skillstream/api test -- src/logging/__tests__/logging.module.test.ts src/common/__tests__/all-exceptions.filter.test.ts
pnpm --filter @skillstream/api typecheck
```

Expected: all tests pass and typecheck exits 0.

- [ ] **Step 6: Commit Nest lifecycle integration**

```bash
git add apps/api/src/logging/logging.constants.ts apps/api/src/logging/logging.module.ts apps/api/src/logging/__tests__/logging.module.test.ts apps/api/src/app.module.ts apps/api/src/main.ts
git commit -m "feat(api): install global structured logger"
```

---

### Task 5: Add Correlated HTTP Completion Logs

**Files:**
- Create: `apps/api/src/logging/request-logging.middleware.ts`
- Create: `apps/api/src/logging/__tests__/request-logging.middleware.test.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: Nest `Logger`; does not consume Pino or destination types
- Produces: validated/generated `X-Request-Id` response header
- Produces one structured completion record:

```ts
{
  event: "http.request.completed";
  requestId: string;
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
}
```

- [ ] **Step 1: Write failing middleware tests**

Use mocked Express request/response objects with an `EventEmitter` response.
Assert:

- a valid request ID matching `/^[A-Za-z0-9._-]{1,128}$/` is reused;
- a missing or invalid value is replaced with `randomUUID()`;
- the ID is returned as `X-Request-Id`;
- exactly one log is emitted on `finish`;
- the record contains method, `originalUrl` without query-string secrets,
  status, duration, and request ID;
- no request body or authorization/cookie values are logged.

Inject `now: () => number` and `createRequestId: () => string` into private
testable helpers or constructor options so duration and IDs are deterministic.

- [ ] **Step 2: Run middleware tests and verify RED**

Run:

```bash
pnpm --filter @skillstream/api test -- src/logging/__tests__/request-logging.middleware.test.ts
```

Expected: FAIL because the middleware does not exist.

- [ ] **Step 3: Implement middleware using only Nest logging APIs**

The middleware:

1. reads the first `x-request-id` header value;
2. validates it against the exact pattern and length;
3. generates a UUID when invalid/missing;
4. sets `X-Request-Id` on the response;
5. captures `performance.now()`;
6. listens once to `finish`;
7. logs the structured completion object with Nest context `HTTP`.

Normalize the route with `new URL(req.originalUrl, "http://local").pathname`
so query values are never recorded. Do not attach request/response objects or
bodies to the record.

- [ ] **Step 4: Register middleware globally**

Make `AppModule implements NestModule` and apply
`RequestLoggingMiddleware` to `"*"` through `MiddlewareConsumer`. Keep the
middleware independent of logging destinations.

- [ ] **Step 5: Verify middleware and full common tests**

Run:

```bash
pnpm --filter @skillstream/api test -- src/logging/__tests__/request-logging.middleware.test.ts src/common/__tests__
pnpm --filter @skillstream/api typecheck
```

Expected: tests and typecheck exit 0.

- [ ] **Step 6: Commit HTTP observability**

```bash
git add apps/api/src/logging/request-logging.middleware.ts apps/api/src/logging/__tests__/request-logging.middleware.test.ts apps/api/src/app.module.ts
git commit -m "feat(api): add correlated HTTP request logs"
```

---

### Task 6: Verify End-to-End Output Modes and Documentation

**Files:**
- Create: `apps/api/src/logging/__tests__/logging.integration.test.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes all prior logging interfaces
- Produces no new application API

- [ ] **Step 1: Write output-mode integration tests**

Build the logging runtime with temporary streams/directories. Define a local
`captureDestination()` helper that returns a `PassThrough`, accumulates its
UTF-8 chunks, implements the exact `LogDestination` contract, and exposes a
`text()` reader. Then implement these cases with the runtime's injected
`createDestination` and `consoleStream` options:

```ts
it("development writes pretty console and a parseable daily JSON file", async () => {
  const file = captureDestination();
  const console = new PassThrough();
  const runtime = await createLoggingRuntime(developmentEnv, {
    createDestination: async () => file.destination,
    consoleStream: console,
  });
  runtime.logger.log({ event: "integration.ready" }, "IntegrationTest");
  await runtime.close();
  expect(file.text().trim().split("\n").map(JSON.parse)[0]).toMatchObject({
    event: "integration.ready",
    context: "IntegrationTest",
  });
});

it("production writes JSON to stdout and creates no LOG_DIR", async () => {
  const stdout = captureDestination();
  const runtime = await createLoggingRuntime(productionEnv, {
    createDestination: async () => stdout.destination,
  });
  runtime.logger.log("ready", "IntegrationTest");
  await runtime.close();
  expect(JSON.parse(stdout.text().trim())).toMatchObject({ msg: "ready" });
  await expect(stat(productionEnv.LOG_DIR)).rejects.toMatchObject({ code: "ENOENT" });
});
```

Add a redaction integration case that logs nested headers/tokens and searches
both captured outputs for the original secret strings. Add a shutdown case that
reads the last record after `close()` to prove flushing.

- [ ] **Step 2: Run integration tests and fix only integration defects**

Run:

```bash
pnpm --filter @skillstream/api test -- src/logging/__tests__/logging.integration.test.ts
```

Expected: PASS. If a test fails, make the smallest correction in the owning
logging unit and rerun this file before proceeding.

- [ ] **Step 3: Document operating and search commands**

Add a concise API logging section to `README.md`:

````markdown
### API logs

Development writes readable logs to the console and structured JSON Lines to
`apps/api/logs/logger-YYYY-MM-DD.log` by default. Files older than 14 UTC days
are removed automatically.

```bash
# Search message text
rg 'payment failed' apps/api/logs/

# Filter errors with jq
jq -c 'select(.level >= 50)' apps/api/logs/logger-$(date -u +%F).log
```

Production uses `LOG_DESTINATION=stdout` and does not create log files. Future
centralized destinations are added behind the logging destination factory.
````

Document all four environment variables and the production restriction.

- [ ] **Step 4: Run the complete verification suite**

Run fresh commands:

```bash
pnpm --filter @skillstream/api test
pnpm --filter @skillstream/api typecheck
pnpm --filter @skillstream/api lint
pnpm --filter @skillstream/api build
git diff --check
```

Expected: every command exits 0 with no test failures, type errors, lint errors,
build errors, or whitespace errors.

- [ ] **Step 5: Manually verify production creates no files**

Use a temporary directory outside the repository and start the built API with
`NODE_ENV=production`, `LOG_DESTINATION=stdout`, and the required environment.
Send one request to `/api/health`, stop gracefully, and verify:

- stdout contains parseable JSON startup and request completion records;
- the temporary `LOG_DIR` does not exist;
- no secret environment value appears in captured stdout.

Do not run this against shared infrastructure; use the existing local
development database/Redis or mock only what boot requires.

- [ ] **Step 6: Commit integration coverage and documentation**

```bash
git add README.md apps/api/src/logging/__tests__/logging.integration.test.ts
git commit -m "test(api): verify structured logging modes"
```

---

## Final Review Checklist

- [ ] `rg -n 'from .*pino|from .*/logging/' apps/api/src/modules apps/api/src/common --glob '*.ts'` finds no Pino/destination imports in services, controllers, repositories, guards, interceptors, or filters.
- [ ] `NODE_ENV=development` defaults to file plus readable console.
- [ ] `NODE_ENV=production` defaults to stdout and rejects file.
- [ ] Development files are UTC-dated JSON Lines and retain exactly the latest 14-day window.
- [ ] Production creates no log directory or file.
- [ ] Redaction tests prove known secrets are absent from every output.
- [ ] Existing `PUBLIC_API_URL` blank-string normalization remains present.
- [ ] `git status --short` contains no generated logs and no unintended user-file changes.

# Replaceable File Logging Design

## Summary

SkillStream API will use Pino as its structured logging engine behind Nest's
`LoggerService` contract. Application modules and services will continue to use
Nest's `Logger` and must not import Pino or destination-specific APIs.

Development writes JSON Lines to daily files with 14-day retention. Production
writes structured JSON to stdout only. The destination boundary will allow a
future Loki, OpenTelemetry, or other backend to be added through configuration
without changing application services.

## Goals

- Preserve Nest's `Logger`/`LoggerService` as the application-facing API.
- Write structured, searchable JSON Lines to a daily log file in development.
- Keep 14 days of daily files.
- Keep readable console output in development.
- Write structured JSON to stdout only in production.
- Redact credentials and other sensitive request data.
- Fail production startup when the configured logging destination cannot
  initialize.
- Make the destination selectable and replaceable through configuration.

## Non-goals

- A browser-based or live log viewer.
- Loki or OpenTelemetry implementations in the initial release.
- Metrics collection. Prometheus integration is a separate concern.
- Replacing Sentry error reporting.
- Changing existing services to use Pino directly.

## Architecture

### Application-facing logger

An application-owned Nest `LoggerService` adapter will be registered as the
global logger during bootstrap. It implements Nest's logging methods and maps
them to a Pino logger.

Existing code such as `new Logger(ServiceName)` remains valid. No application
service imports Pino, a transport, or a destination.

### Destination contract

A small internal destination contract owns destination initialization and
lifecycle. A destination factory selects an implementation from validated
configuration.

The initially supported values are:

```text
LOG_DESTINATION=file
LOG_DESTINATION=stdout
```

`stdout` is the production destination and `file` is the development
destination. Configuration validation rejects `file` in production during the
initial rollout, ensuring production never creates local log files. The factory
will reject unsupported values. `loki` and `otel` will not be accepted or
represented by nonfunctional stubs; adding either later means implementing the
same contract and extending the validated configuration union. This avoids a
configuration that appears to work while silently discarding logs.

The contract exposes only the capabilities the logging composition layer
needs: initialize the destination, provide a writable Pino target/stream, and
close it gracefully. Application code cannot access this contract.

### File destination

The file destination:

- creates the configured directory when necessary;
- writes one JSON object per line;
- names files `logger-YYYY-MM-DD.log`;
- rotates when the calendar date changes;
- removes matching daily files older than the configured retention period;
- ignores unrelated files in the directory;
- exposes an explicit close operation so buffered records are flushed during
  shutdown.

Dates used in filenames and retention calculations will use UTC. This avoids
rotation ambiguity across hosts and daylight-saving transitions.

Retention cleanup runs during file-destination initialization and after
rotation. A cleanup failure is logged to the remaining output but does not
terminate an already-running application. Failure to create or open the active
development log file is an initialization failure rather than a silent fallback
that pretends file logging is active.

## Output Behavior

### Development

Development writes to two outputs:

1. readable, colorized console output;
2. structured JSON Lines in the configured daily file.

The file contains the canonical structured record. Console formatting does not
alter it.

### Production

Production writes structured JSON Lines to stdout only. It does not create or
write daily log files. Stdout preserves compatibility with container log
collectors and provides the handoff point for a future centralized destination.

### Test

Tests will not write to the repository's log directory by default. Logger tests
use temporary directories and controlled streams.

## Configuration

The validated environment schema gains:

```text
LOG_DESTINATION=file|stdout
LOG_LEVEL=info
LOG_DIR=logs
LOG_RETENTION_DAYS=14
```

Rules:

- `LOG_DESTINATION` initially accepts `file` and `stdout`.
- The default is `file` in development and `stdout` in production.
- Production rejects `file` during the initial rollout.
- `LOG_LEVEL` accepts Pino's supported named levels.
- When `LOG_DESTINATION=file`, `LOG_DIR` must be a nonempty path and
  `LOG_RETENTION_DAYS` must be a positive integer.

Relative `LOG_DIR` paths resolve from the API process working directory. The
resolved development directory and active filename are reported at startup
without exposing sensitive configuration.

The repository-level `.gitignore` will exclude the runtime log directory and
`*.log` files.

## Record Shape

Each structured record includes:

- timestamp;
- numeric and named severity;
- message;
- Nest context when provided;
- environment;
- service name;
- request identifier when available;
- request method and route for HTTP records;
- response status and duration for completed requests;
- error name, message, and stack for errors.

Pino serializers will preserve structured errors instead of flattening them
into strings.

## Redaction

Redaction covers, at minimum:

- `authorization` and `cookie` request headers;
- `set-cookie` response headers;
- passwords and password confirmations;
- access and refresh tokens;
- API keys, client secrets, signing keys, and webhook secrets;
- known secret environment field names when attached accidentally.

Redacted fields remain identifiable in the record but their values are replaced
with a fixed marker. Request bodies are not logged automatically. Any later
body logging must opt in to an explicit allowlist.

## HTTP and Application Logging

HTTP request completion records are produced through the logging integration
and include request correlation. Incoming `X-Request-Id` values may be reused
only after validation; otherwise the API generates an identifier and returns it
in the response.

Nest bootstrap logs, uncaught application exceptions, existing exception-filter
records, and service `Logger` calls all flow through the same global adapter.
Direct `console.log`, `console.warn`, and `console.error` calls in bootstrap code
will be migrated to the Nest logger so they reach the configured outputs.

## Failure Handling and Lifecycle

- Startup fails with a concise stderr message if the configured destination
  cannot initialize.
- Development does not silently fall back to console when configured file
  logging fails.
- Runtime file write errors are surfaced through a safe stderr fallback without
  recursively invoking the failed logger.
- Shutdown hooks flush and close the destination.
- Logging failures never include secrets or entire environment objects.

## Extension Path

Adding Loki or OpenTelemetry later requires:

1. implementing the internal destination contract;
2. adding the implementation to the destination factory;
3. extending `LOG_DESTINATION` validation and destination-specific validated
   configuration;
4. adding contract and integration tests.

No controller, service, repository, guard, interceptor, or filter changes are
required. A future deployment may select a remote destination through
configuration while preserving the Nest logging API.

## Testing

Unit tests will verify:

- configuration defaults and invalid values;
- destination factory selection and rejection of unsupported destinations;
- Nest log-level mapping and preservation of context;
- structured record shape;
- sensitive-field redaction;
- UTC daily filename generation;
- cleanup of expired matching files while preserving recent and unrelated
  files;
- initialization and close behavior.

Integration tests will verify:

- development emits readable console output and structured file output;
- production emits structured stdout and creates no log file;
- existing Nest `Logger` calls reach the configured file;
- HTTP completion and error records include correlation metadata;
- development startup fails when the configured log directory is unusable;
- shutdown flushes the active file.

Tests use temporary directories and fixed clocks to remain deterministic.

## Acceptance Criteria

- Starting the API in development creates `logger-YYYY-MM-DD.log` in `LOG_DIR`.
- Every line in the file parses as one JSON object.
- Nest service logs and HTTP logs appear in the file.
- Development retains readable console logs.
- Production stdout is structured JSON and production creates no log file.
- Sensitive values do not appear in either output.
- Files older than 14 UTC days are deleted; recent and unrelated files remain.
- An unsupported destination, `file` in production, or an unusable development
  log directory fails startup with a clear error.
- Application services contain no Pino or destination imports.

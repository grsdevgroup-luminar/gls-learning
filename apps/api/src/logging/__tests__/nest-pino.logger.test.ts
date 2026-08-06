import { Writable } from "node:stream";
import pino from "pino";
import { describe, expect, it } from "vitest";
import { NestPinoLogger } from "../nest-pino.logger";
import { REDACT_PATHS } from "../redaction";

interface LogRecord {
  level: number;
  msg?: string;
  context?: string;
  stack?: string;
  err?: { name?: string; message?: string; stack?: string };
  [key: string]: unknown;
}

const createLogger = () => {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(chunk.toString());
      callback();
    },
  });
  const logger = new NestPinoLogger(
    pino(
      {
        level: "trace",
        redact: { paths: [...REDACT_PATHS], censor: "[Redacted]" },
        serializers: { err: pino.stdSerializers.err },
      },
      stream,
    ),
  );

  return {
    logger,
    records: (): LogRecord[] => lines.map((line) => JSON.parse(line)),
  };
};

describe("NestPinoLogger", () => {
  it.each([
    ["log", 30],
    ["warn", 40],
    ["debug", 20],
    ["verbose", 10],
    ["fatal", 60],
  ] as const)("maps Nest %s to Pino level %i", (method, level) => {
    const { logger, records } = createLogger();

    logger[method]("record");

    expect(records()).toMatchObject([{ level, msg: "record" }]);
  });

  it("emits a final string optional parameter as context", () => {
    const { logger, records } = createLogger();

    logger.log("ready", "Bootstrap");

    expect(records()).toMatchObject([
      { level: 30, msg: "ready", context: "Bootstrap" },
    ]);
  });

  it("preserves a Nest error stack and context", () => {
    const { logger, records } = createLogger();

    logger.error("query failed", "Error: boom\n at test", "UsersService");

    expect(records()).toMatchObject([
      {
        level: 50,
        msg: "query failed",
        context: "UsersService",
        stack: expect.stringContaining("Error: boom"),
      },
    ]);
  });

  it("preserves non-context diagnostic parameters structurally", () => {
    const { logger, records } = createLogger();
    const response = { status: 401, body: { code: "invalid_api_key" } };
    const retry = { attempt: 2 };

    logger.error("email delivery failed", response, retry, "EmailService");

    expect(records()).toMatchObject([
      {
        msg: "email delivery failed",
        context: "EmailService",
        diagnostics: [response, retry],
      },
    ]);
  });

  it("preserves one non-context diagnostic parameter with context", () => {
    const { logger, records } = createLogger();
    const response = { status: 503, body: { code: "mail_unavailable" } };

    logger.error("email delivery failed", response, "EmailService");

    expect(records()).toMatchObject([
      {
        msg: "email delivery failed",
        context: "EmailService",
        diagnostics: [response],
      },
    ]);
  });

  it("serializes an Error message with its name, message, and stack", () => {
    const { logger, records } = createLogger();
    const error = new TypeError("database unavailable");

    logger.error(error, "DatabaseService");

    expect(records()).toMatchObject([
      {
        level: 50,
        context: "DatabaseService",
        err: {
          type: "TypeError",
          message: "database unavailable",
          stack: expect.stringContaining("TypeError: database unavailable"),
        },
      },
    ]);
  });

  it("keeps object messages structured", () => {
    const { logger, records } = createLogger();

    logger.log({ event: "course.published", courseId: "course_123" });

    expect(records()).toMatchObject([
      { level: 30, event: "course.published", courseId: "course_123" },
    ]);
    expect(records()[0]?.msg).not.toBe("[object Object]");
  });

  it("redacts sensitive root-level fields", () => {
    const { logger, records } = createLogger();
    const secrets = {
      authorization: "Bearer token",
      cookie: "session=secret",
      password: "password",
      accessToken: "access-token",
      refreshToken: "refresh-token",
      apiKey: "api-key",
      clientSecret: "client-secret",
      signingKey: "signing-key",
      webhookSecret: "webhook-secret",
    };

    logger.log(secrets);

    expect(records()[0]).toMatchObject({
      authorization: "[Redacted]",
      cookie: "[Redacted]",
      password: "[Redacted]",
      accessToken: "[Redacted]",
      refreshToken: "[Redacted]",
      apiKey: "[Redacted]",
      clientSecret: "[Redacted]",
      signingKey: "[Redacted]",
      webhookSecret: "[Redacted]",
    });
  });
  it("redacts raw secrets in diagnostic objects", () => {
    const { logger, records } = createLogger();

    logger.error("failed", { authorization: "Bearer diagnostic-secret" }, "Auth");

    expect(JSON.stringify(records())).not.toContain("Bearer diagnostic-secret");
  });
});

import { EventEmitter } from "node:events";
import { Writable } from "node:stream";
import { Logger, type LoggerService } from "@nestjs/common";
import pino from "pino";
import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import {
  RequestLoggingMiddleware,
  type RequestLoggingMiddlewareOptions,
} from "../request-logging.middleware";
import { NestPinoLogger } from "../nest-pino.logger";
import { REDACT_PATHS } from "../redaction";

type CompletionRecord = {
  event: "http.request.completed";
  requestId: string;
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
};

const createRequest = (options: {
  headers?: Record<string, string | string[] | undefined>;
  method?: string;
  originalUrl?: string;
  body?: unknown;
} = {}): Request =>
  ({
    headers: options.headers ?? {},
    method: options.method ?? "GET",
    originalUrl: options.originalUrl ?? "/",
    body: options.body,
  }) as Request;

const createResponse = (statusCode = 200) => {
  const response = Object.assign(new EventEmitter(), {
    statusCode,
    setHeader: vi.fn(),
  }) as unknown as Response;
  response.send = vi.fn(function (this: Response) {
    return this;
  }) as Response["send"];
  response.json = vi.fn(function (this: Response, body: unknown) {
    return this.send(body);
  }) as Response["json"];
  return response;
};

const createMiddleware = (
  options: Omit<RequestLoggingMiddlewareOptions, "logger"> = {},
) => {
  const logger = { log: vi.fn() };
  return {
    logger,
    middleware: new RequestLoggingMiddleware({ ...options, logger }),
  };
};

describe("RequestLoggingMiddleware", () => {
  it("includes the JSON response body in the completion record", () => {
    const { logger, middleware } = createMiddleware({
      now: vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(137),
    });
    const response = createResponse(422);

    middleware.use(createRequest(), response, vi.fn());
    response.json({ message: "Validation failed" });
    response.emit("finish");

    expect(logger.log).toHaveBeenCalledWith({
      event: "http.request.completed",
      requestId: expect.any(String),
      method: "GET",
      route: "/",
      statusCode: 422,
      durationMs: 37,
      response: { message: "Validation failed" },
    });
  });

  it("includes a body sent directly through Express", () => {
    const { logger, middleware } = createMiddleware();
    const response = createResponse(400);

    middleware.use(createRequest(), response, vi.fn());
    expect(response.send("Bad request")).toBe(response);
    response.emit("finish");

    expect(logger.log).toHaveBeenCalledWith(
      expect.objectContaining({ response: "Bad request" }),
    );
  });

  it("reuses a valid ID and emits one redacted completion record", () => {
    const { logger, middleware } = createMiddleware({
      now: vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(137),
    });
    const requestId = "client.request_42";
    const request = createRequest({
      headers: {
        "x-request-id": requestId,
        authorization: "Bearer request-secret",
        cookie: "session=cookie-secret",
      },
      method: "POST",
      originalUrl: "/courses?accessToken=query-secret",
      body: { password: "body-secret" },
    });
    const response = createResponse(201);

    middleware.use(request, response, vi.fn());

    expect(response.setHeader).toHaveBeenCalledWith("X-Request-Id", requestId);
    expect(logger.log).not.toHaveBeenCalled();

    response.emit("finish");
    response.emit("finish");

    expect(logger.log).toHaveBeenCalledTimes(1);
    expect(logger.log).toHaveBeenCalledWith(
      {
        event: "http.request.completed",
        requestId,
        method: "POST",
        route: "/courses",
        statusCode: 201,
        durationMs: 37,
      } satisfies CompletionRecord,
    );
    expect(JSON.stringify(logger.log.mock.calls)).not.toContain("request-secret");
    expect(JSON.stringify(logger.log.mock.calls)).not.toContain("cookie-secret");
    expect(JSON.stringify(logger.log.mock.calls)).not.toContain("query-secret");
    expect(JSON.stringify(logger.log.mock.calls)).not.toContain("body-secret");
  });

  it.each([
    ["missing", undefined],
    ["invalid", "not a valid request ID!"],
    ["invalid first header", ["not valid!", "client.request_42"]],
  ])("replaces a %s request ID", (_case, requestId) => {
    const { middleware } = createMiddleware({
      createRequestId: () => "generated-request-id",
    });
    const response = createResponse();

    middleware.use(
      createRequest({ headers: { "x-request-id": requestId } }),
      response,
      vi.fn(),
    );

    expect(response.setHeader).toHaveBeenCalledWith(
      "X-Request-Id",
      "generated-request-id",
    );
  });
});

const createCapturedLogger = () => {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(chunk.toString());
      callback();
    },
  });

  return {
    logger: new NestPinoLogger(
      pino(
        {
          base: null,
          timestamp: false,
          redact: { paths: [...REDACT_PATHS], censor: "[Redacted]" },
        },
        stream,
      ),
    ),
    records: (): Record<string, unknown>[] =>
      lines.map((line) => JSON.parse(line) as Record<string, unknown>),
  };
};

describe("request ID validation", () => {
  it.each([
    ["128 characters", "a".repeat(128)],
    ["period", "client.request"],
    ["underscore", "client_request"],
    ["hyphen", "client-request"],
  ])("reuses an accepted ID with %s", (_case, requestId) => {
    const { middleware } = createMiddleware({
      createRequestId: () => "generated-request-id",
    });
    const response = createResponse();

    middleware.use(
      createRequest({ headers: { "x-request-id": requestId } }),
      response,
      vi.fn(),
    );

    expect(response.setHeader).toHaveBeenCalledWith("X-Request-Id", requestId);
  });

  it("replaces an ID longer than 128 characters", () => {
    const { middleware } = createMiddleware({
      createRequestId: () => "generated-request-id",
    });
    const response = createResponse();

    middleware.use(
      createRequest({ headers: { "x-request-id": "a".repeat(129) } }),
      response,
      vi.fn(),
    );

    expect(response.setHeader).toHaveBeenCalledWith(
      "X-Request-Id",
      "generated-request-id",
    );
  });
});

describe("production Nest Logger path", () => {
  it("writes HTTP context without duplicate diagnostics", () => {
    const { logger, records } = createCapturedLogger();
    const originalLogger = (
      Logger as unknown as { staticInstanceRef?: LoggerService }
    ).staticInstanceRef;
    Logger.overrideLogger(logger);

    try {
      const middleware = new RequestLoggingMiddleware({
        now: vi.fn().mockReturnValueOnce(10).mockReturnValueOnce(35),
      });
      const response = createResponse(204);

      middleware.use(
        createRequest({
          headers: { "x-request-id": "production.request" },
          method: "DELETE",
          originalUrl: "/sessions?token=never-log-this",
        }),
        response,
        vi.fn(),
      );
      response.json({ password: "response-secret", message: "No content" });
      response.emit("finish");

      expect(records()).toMatchObject([
        {
          event: "http.request.completed",
          requestId: "production.request",
          method: "DELETE",
          route: "/sessions",
          statusCode: 204,
          durationMs: 25,
          context: "HTTP",
          response: { password: "[Redacted]", message: "No content" },
        },
      ]);
      expect(records()[0]).not.toHaveProperty("diagnostics");
    } finally {
      Logger.overrideLogger(originalLogger ?? false);
    }
  });
});

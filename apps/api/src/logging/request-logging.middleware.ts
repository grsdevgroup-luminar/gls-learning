import {
  Inject,
  Injectable,
  Logger,
  Optional,
  type LoggerService,
  type NestMiddleware,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;
const REQUEST_LOGGING_OPTIONS = Symbol("REQUEST_LOGGING_OPTIONS");

export interface RequestLoggingMiddlewareOptions {
  now?: () => number;
  createRequestId?: () => string;
  logger?: Pick<LoggerService, "log">;
}

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly now: () => number;
  private readonly createRequestId: () => string;
  private readonly logger: Pick<LoggerService, "log">;

  constructor(
    @Optional()
    @Inject(REQUEST_LOGGING_OPTIONS)
    options?: RequestLoggingMiddlewareOptions,
  ) {
    this.now = options?.now ?? (() => performance.now());
    this.createRequestId = options?.createRequestId ?? randomUUID;
    this.logger = options?.logger ?? new Logger("HTTP");
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = this.requestIdFor(req.headers["x-request-id"]);
    const startedAt = this.now();

    res.setHeader("X-Request-Id", requestId);
    res.once("finish", () => {
      this.logger.log(
        {
          event: "http.request.completed",
          requestId,
          method: req.method,
          route: new URL(req.originalUrl, "http://local").pathname,
          statusCode: res.statusCode,
          durationMs: this.now() - startedAt,
        },
      );
    });

    next();
  }

  private requestIdFor(value: string | string[] | undefined): string {
    const requestId = Array.isArray(value) ? value[0] : value;
    return requestId && REQUEST_ID_PATTERN.test(requestId)
      ? requestId
      : this.createRequestId();
  }
}

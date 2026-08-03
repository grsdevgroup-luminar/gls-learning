import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Request, Response } from "express";

const stillReferenced = () =>
  new ConflictException("Cannot complete: other records still reference this one");

/**
 * Prisma codes that describe an expected client condition rather than a bug.
 * Messages are ours, not Prisma's: theirs carry SQL and file paths.
 */
const PRISMA_ERRORS: Record<string, () => HttpException> = {
  P2025: () => new NotFoundException("Record not found"),
  P2002: () => new ConflictException("Already exists"),
  P2003: stillReferenced,
};

/**
 * An `onDelete: Restrict` relation makes Postgres raise 23001, but Prisma only
 * translates 23503 into P2003 — so a restrict hit arrives as an *Unknown*
 * error and would otherwise read as a 500. Same meaning, so same 409.
 */
const PG_RESTRICT_VIOLATION = /code: "23001"/;

/**
 * A hit constraint (missing row, duplicate, still-referenced FK) is the
 * caller's doing, not a server fault — restate it as the matching 4xx so every
 * route gets this without its own try/catch. Anything else passes through.
 */
function asHttpException(e: unknown): unknown {
  if (e instanceof Prisma.PrismaClientKnownRequestError && PRISMA_ERRORS[e.code]) {
    return PRISMA_ERRORS[e.code]();
  }
  if (
    e instanceof Prisma.PrismaClientUnknownRequestError &&
    PG_RESTRICT_VIOLATION.test(e.message)
  ) {
    return stillReferenced();
  }
  return e;
}

/** Converts any thrown error into a consistent problem-detail JSON body. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(caught: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const exception = asHttpException(caught);

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = "Internal server error";
    let error = "InternalServerError";

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === "string") {
        message = body;
        error = exception.name;
      } else if (typeof body === "object" && body !== null) {
        const b = body as Record<string, unknown>;
        message = (b.message as string | string[]) ?? exception.message;
        error = (b.error as string) ?? exception.name;
      }
    }
    // Anything left is unintended (bugs, unmapped Prisma codes). Its message can
    // carry file paths, SQL, and query source, so the client keeps the generic
    // 500 above and the detail goes to the log below only.

    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.url} -> ${status}`,
        caught instanceof Error ? caught.stack : String(caught),
      );
    }

    res.status(status).json({
      success: false,
      statusCode: status,
      error,
      message,
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }
}

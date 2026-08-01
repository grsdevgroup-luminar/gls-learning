import { describe, expect, it } from "vitest";
import type { ArgumentsHost } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AllExceptionsFilter } from "../all-exceptions.filter";

/** Drives the filter and reports what the client would actually receive. */
function run(thrown: unknown) {
  let status = 0;
  let body: Record<string, unknown> = {};
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({
        status(s: number) {
          status = s;
          return this;
        },
        json: (b: Record<string, unknown>) => {
          body = b;
        },
      }),
      getRequest: () => ({ method: "DELETE", url: "/api/courses/abc" }),
    }),
  } as unknown as ArgumentsHost;
  new AllExceptionsFilter().catch(thrown, host);
  return { status, body };
}

const known = (code: string) =>
  new Prisma.PrismaClientKnownRequestError("db said no", { code, clientVersion: "6" });

describe("AllExceptionsFilter", () => {
  it("maps a missing row to 404", () => {
    expect(run(known("P2025")).status).toBe(404);
  });

  it("maps a duplicate to 409", () => {
    expect(run(known("P2002")).status).toBe(409);
  });

  it("maps a foreign-key violation to 409", () => {
    expect(run(known("P2003")).status).toBe(409);
  });

  // Postgres raises 23001 for `onDelete: Restrict`, which Prisma leaves
  // unmapped — the exact shape that made DELETE /courses/:id a blind 500.
  it("maps a Postgres 23001 restrict violation to 409, not 500", () => {
    const err = new Prisma.PrismaClientUnknownRequestError(
      'Error occurred during query execution:\nConnectorError(QueryError(PostgresError { code: "23001", ' +
        'message: "violates RESTRICT setting of foreign key constraint \\"OrderItem_courseId_fkey\\"" }))',
      { clientVersion: "6" },
    );
    const { status, body } = run(err);
    expect(status).toBe(409);
    expect(body.message).toMatch(/still reference/i);
  });

  it("keeps unmapped errors a 500 and leaks no query detail", () => {
    const { status, body } = run(new Error("connect ECONNREFUSED /var/run/pg.sock"));
    expect(status).toBe(500);
    expect(body.message).toBe("Internal server error");
    expect(JSON.stringify(body)).not.toMatch(/ECONNREFUSED|pg\.sock/);
  });
});

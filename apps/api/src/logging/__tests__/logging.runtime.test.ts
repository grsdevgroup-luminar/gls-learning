import { Writable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { validateEnv } from "../../config/env";
import type { LogDestination } from "../logging.types";
import { createLoggingRuntime } from "../logging.runtime";

const base = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  JWT_ACCESS_SECRET: "0123456789abcdef",
};

const parseRecords = (lines: string[]) =>
  lines.flatMap((line) =>
    line
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((entry) => JSON.parse(entry) as Record<string, unknown>),
  );

const captureStream = (lines: string[]) =>
  new Writable({
    write(chunk, _encoding, callback) {
      lines.push(chunk.toString());
      callback();
    },
  });

const createFlushableStream = () => {
  const lines: string[] = [];
  const final = vi.fn();
  let writes = Promise.resolve();
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      writes = writes.then(
        () =>
          new Promise<void>((resolve) => {
            setTimeout(() => {
              lines.push(chunk.toString());
              callback();
              resolve();
            }, 0);
          }),
      );
    },
    final(callback) {
      final();
      callback();
    },
  });
  const flush = vi.fn((callback?: (error?: Error) => void) => {
    void writes.then(() => callback?.());
  });
  Object.assign(stream, { flush });

  return { stream, lines, flush, final };
};

const createDestination = () => {
  const lines: string[] = [];
  const close = vi.fn(async () => undefined);
  const destination: LogDestination = {
    stream: captureStream(lines),
    close,
  };
  return { destination, lines, close };
};

describe("createLoggingRuntime", () => {
  it("writes redacted logical records to console and file in development", async () => {
    const file = createDestination();
    const consoleLines: string[] = [];
    const runtime = await createLoggingRuntime(
      validateEnv({
        ...base,
        NODE_ENV: "development",
        LOG_DESTINATION: "file",
      }),
      {
        createDestination: async () => file.destination,
        consoleStream: captureStream(consoleLines),
      },
    );

    runtime.logger.log({ event: "ready", password: "secret" }, "Bootstrap");
    runtime.logger.error(
      "failed",
      { authorization: "Bearer runtime-secret" },
      "Auth",
    );
    await runtime.close();

    expect(parseRecords(file.lines)).toMatchObject([
      { event: "ready", password: "[Redacted]", context: "Bootstrap" },
      {
        msg: "failed",
        context: "Auth",
        diagnostics: [{ authorization: "[Redacted]" }],
      },
    ]);
    expect(parseRecords(consoleLines)).toMatchObject([
      { event: "ready", password: "[Redacted]", context: "Bootstrap" },
      {
        msg: "failed",
        context: "Auth",
        diagnostics: [{ authorization: "[Redacted]" }],
      },
    ]);
    expect(JSON.stringify(file.lines)).not.toContain("Bearer runtime-secret");
    expect(JSON.stringify(consoleLines)).not.toContain("Bearer runtime-secret");
    expect(file.close).toHaveBeenCalledOnce();
  });

  it("writes production records only to stdout and closes the destination once", async () => {
    const stdout = createDestination();
    const consoleLines: string[] = [];
    const runtime = await createLoggingRuntime(
      validateEnv({
        ...base,
        NODE_ENV: "production",
        LOG_DESTINATION: "stdout",
      }),
      {
        createDestination: async () => stdout.destination,
        consoleStream: captureStream(consoleLines),
      },
    );

    runtime.logger.log({ event: "ready", password: "secret" });
    await runtime.close();
    await runtime.close();

    expect(parseRecords(stdout.lines)).toMatchObject([
      { event: "ready", password: "[Redacted]" },
    ]);
    expect(consoleLines).toEqual([]);
    expect(stdout.close).toHaveBeenCalledOnce();
  });

  it("flushes both development branches and finalizes the owned pretty stream once", async () => {
    const file = createDestination();
    const fileStream = createFlushableStream();
    const pretty = createFlushableStream();
    const destination: LogDestination = {
      ...file.destination,
      stream: fileStream.stream,
    };
    const runtime = await createLoggingRuntime(
      validateEnv({
        ...base,
        NODE_ENV: "development",
        LOG_DESTINATION: "file",
      }),
      {
        createDestination: async () => destination,
        createPrettyStream: () => pretty.stream,
      },
    );

    runtime.logger.log({ event: "shutdown" });
    await runtime.close();
    await runtime.close();

    expect(parseRecords(fileStream.lines)).toMatchObject([
      { event: "shutdown" },
    ]);
    expect(parseRecords(pretty.lines)).toMatchObject([{ event: "shutdown" }]);
    expect(fileStream.flush).toHaveBeenCalled();
    expect(pretty.flush).toHaveBeenCalled();
    expect(pretty.final).toHaveBeenCalledOnce();
    expect(file.close).toHaveBeenCalledOnce();
  });
});

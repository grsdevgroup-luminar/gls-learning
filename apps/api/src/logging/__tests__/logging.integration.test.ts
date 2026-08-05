import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { finished } from "node:stream/promises";
import pinoPretty from "pino-pretty";
import { afterEach, describe, expect, it } from "vitest";
import { validateEnv } from "../../config/env";
import type { LogDestination } from "../logging.types";
import { createLoggingRuntime } from "../logging.runtime";

const base = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  JWT_ACCESS_SECRET: "0123456789abcdef",
};

const temporaryDirectories: string[] = [];

const createTemporaryDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), "skillstream-logging-"));
  temporaryDirectories.push(directory);
  return directory;
};

const captureDestination = () => {
  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  stream.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));

  const destination: LogDestination = {
    stream,
    close: async () => {
      stream.end();
      await finished(stream);
    },
  };

  return {
    destination,
    text: () => Buffer.concat(chunks).toString("utf8"),
  };
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("logging output modes", () => {
  it("development writes pretty console and a parseable daily JSON file", async () => {
    const directory = await createTemporaryDirectory();
    const file = captureDestination();
    const console = new PassThrough();
    const pretty = pinoPretty({
      colorize: false,
      destination: console,
      sync: true,
    });
    const consoleChunks: Buffer[] = [];
    console.on("data", (chunk: Buffer) =>
      consoleChunks.push(Buffer.from(chunk)),
    );
    const developmentEnv = validateEnv({
      ...base,
      NODE_ENV: "development",
      LOG_DESTINATION: "file",
      LOG_DIR: join(directory, "logs"),
    });
    const runtime = await createLoggingRuntime(developmentEnv, {
      createDestination: async () => file.destination,
      createPrettyStream: () => pretty,
    });

    runtime.logger.log({ event: "integration.ready" }, "IntegrationTest");
    await runtime.close();

    expect(
      file
        .text()
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as Record<string, unknown>)[0],
    ).toMatchObject({
      event: "integration.ready",
      context: "IntegrationTest",
    });
    const prettyText = Buffer.concat(consoleChunks).toString("utf8");
    expect(prettyText).toContain("INFO");
    expect(prettyText).toContain("integration.ready");
    expect(prettyText.trim().startsWith("{")).toBe(false);
    expect(pretty.writableFinished).toBe(true);
  });

  it("production writes JSON to stdout and creates no LOG_DIR", async () => {
    const directory = await createTemporaryDirectory();
    const stdout = captureDestination();
    const productionEnv = validateEnv({
      ...base,
      NODE_ENV: "production",
      LOG_DESTINATION: "stdout",
      LOG_DIR: join(directory, "logs"),
    });
    const runtime = await createLoggingRuntime(productionEnv, {
      createDestination: async () => stdout.destination,
    });

    runtime.logger.log("ready", "IntegrationTest");
    await runtime.close();

    expect(JSON.parse(stdout.text().trim())).toMatchObject({ msg: "ready" });
    await expect(stat(productionEnv.LOG_DIR)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("redacts nested headers and tokens from every development output", async () => {
    const directory = await createTemporaryDirectory();
    const file = captureDestination();
    const console = new PassThrough();
    const consoleChunks: Buffer[] = [];
    console.on("data", (chunk: Buffer) =>
      consoleChunks.push(Buffer.from(chunk)),
    );
    const runtime = await createLoggingRuntime(
      validateEnv({
        ...base,
        NODE_ENV: "development",
        LOG_DESTINATION: "file",
        LOG_DIR: join(directory, "logs"),
      }),
      {
        createDestination: async () => file.destination,
        consoleStream: console,
      },
    );

    runtime.logger.log(
      {
        request: {
          headers: {
            authorization: "Bearer integration-secret",
            cookie: "session=integration-cookie-secret",
          },
          token: "nested-integration-token",
        },
        response: {
          headers: { "set-cookie": "session=integration-set-cookie-secret" },
        },
        JWT_ACCESS_SECRET: "integration-jwt-secret",
        config: {
          STRIPE_SECRET_KEY: "integration-stripe-secret",
          CLOUDFLARE_STREAM_KEY_PEM: "integration-pem-secret",
        },
      },
      "IntegrationTest",
    );
    runtime.logger.log(
      "diagnostic",
      {
        config: { JWT_ACCESS_SECRET: "diagnostic-jwt-secret" },
        response: {
          headers: { "set-cookie": "session=diagnostic-set-cookie-secret" },
        },
      },
      "IntegrationTest",
    );
    await runtime.close();

    const outputs = [
      file.text(),
      Buffer.concat(consoleChunks).toString("utf8"),
    ];
    for (const output of outputs) {
      expect(output).not.toContain("Bearer integration-secret");
      expect(output).not.toContain("session=integration-cookie-secret");
      expect(output).not.toContain("nested-integration-token");
      expect(output).not.toContain("session=integration-set-cookie-secret");
      expect(output).not.toContain("integration-jwt-secret");
      expect(output).not.toContain("integration-stripe-secret");
      expect(output).not.toContain("integration-pem-secret");
      expect(output).not.toContain("diagnostic-jwt-secret");
      expect(output).not.toContain("session=diagnostic-set-cookie-secret");
    }
  });

  it("flushes the final production record before close resolves", async () => {
    const directory = await createTemporaryDirectory();
    const stdout = captureDestination();
    const runtime = await createLoggingRuntime(
      validateEnv({
        ...base,
        NODE_ENV: "production",
        LOG_DESTINATION: "stdout",
        LOG_DIR: join(directory, "logs"),
      }),
      { createDestination: async () => stdout.destination },
    );

    runtime.logger.log({ event: "integration.shutdown" }, "IntegrationTest");
    await runtime.close();

    expect(JSON.parse(stdout.text().trim())).toMatchObject({
      event: "integration.shutdown",
      context: "IntegrationTest",
    });
  });
});

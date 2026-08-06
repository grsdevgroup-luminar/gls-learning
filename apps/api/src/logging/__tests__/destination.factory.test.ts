import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateEnv } from "../../config/env";
import { createLogDestination } from "../destination.factory";

const base = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  JWT_ACCESS_SECRET: "0123456789abcdef",
};

const validEnv = (overrides: Record<string, unknown>) =>
  validateEnv({ ...base, ...overrides });

const pathExists = async (path: string): Promise<boolean> => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

describe("createLogDestination", () => {
  it("returns stdout without creating LOG_DIR", async () => {
    const root = await mkdtemp(join(tmpdir(), "skillstream-logs-"));
    const directory = join(root, "logs");
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
    const root = await mkdtemp(join(tmpdir(), "skillstream-logs-"));
    const directory = join(root, "logs");
    const env = validEnv({
      NODE_ENV: "development",
      LOG_DESTINATION: "file",
      LOG_DIR: directory,
    });

    const destination = await createLogDestination(env);

    expect(destination.activeFile).toMatch(/logger-\d{4}-\d{2}-\d{2}\.log$/);
    await destination.close();
  });
});

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

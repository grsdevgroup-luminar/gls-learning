import type { Env } from "../config/env";
import { createFileDestination } from "./file.destination";
import type { LogDestination } from "./logging.types";

const assertNever = (value: never): never => {
  throw new Error(`Unsupported log destination: ${value}`);
};

export function createLogDestination(env: Env): Promise<LogDestination> {
  switch (env.LOG_DESTINATION) {
    case "stdout":
      return Promise.resolve({
        stream: process.stdout,
        close: async () => undefined,
      });
    case "file":
      return createFileDestination({
        directory: env.LOG_DIR,
        retentionDays: env.LOG_RETENTION_DAYS,
      });
    default:
      return assertNever(env.LOG_DESTINATION);
  }
}

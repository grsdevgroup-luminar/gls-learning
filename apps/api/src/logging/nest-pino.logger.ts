import type { LoggerService } from "@nestjs/common";
import type pino from "pino";

type PinoLevel = "info" | "error" | "warn" | "debug" | "trace" | "fatal";

export class NestPinoLogger implements LoggerService {
  constructor(private readonly logger: pino.Logger) {}

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write("info", message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    const context = this.context(optionalParams);
    const stack = optionalParams.length > 1 ? optionalParams.at(-2) : undefined;
    this.write("error", message, optionalParams, {
      context,
      ...(typeof stack === "string" ? { stack } : {}),
    });
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write("warn", message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write("debug", message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write("trace", message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.write("fatal", message, optionalParams);
  }

  private context(optionalParams: unknown[]): string | undefined {
    const finalParam = optionalParams.at(-1);
    return typeof finalParam === "string" ? finalParam : undefined;
  }

  private write(
    level: PinoLevel,
    message: unknown,
    optionalParams: unknown[],
    metadata: Record<string, unknown> = {},
  ): void {
    const context = metadata.context ?? this.context(optionalParams);
    const diagnostics = context === undefined ? optionalParams : optionalParams.slice(0, -1);
    const bindings = { ...metadata, ...(context === undefined ? {} : { context }), ...(diagnostics.length === 0 ? {} : { diagnostics }) };
    const log = this.logger[level].bind(this.logger) as (object: object, msg?: string) => void;

    if (message instanceof Error) {
      log({ ...bindings, err: message });
      return;
    }

    if (message !== null && typeof message === "object") {
      log({ ...message, ...bindings });
      return;
    }

    log(bindings, String(message));
  }
}

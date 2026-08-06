import type { LoggerService } from "@nestjs/common";
import pino from "pino";
import pinoPretty from "pino-pretty";
import type { Env } from "../config/env";
import { createLogDestination } from "./destination.factory";
import type { LogDestination } from "./logging.types";
import { NestPinoLogger } from "./nest-pino.logger";
import { REDACT_PATHS } from "./redaction";

export interface LoggingRuntime {
  logger: LoggerService;
  close(): Promise<void>;
}

export interface CreateLoggingRuntimeOptions {
  createDestination?: (env: Env) => Promise<LogDestination>;
  consoleStream?: NodeJS.WritableStream;
  createPrettyStream?: () => NodeJS.WritableStream;
}

const flushStream = (stream: NodeJS.WritableStream): Promise<void> => {
  const flush = (
    stream as NodeJS.WritableStream & {
      flush?: (callback?: (error?: Error) => void) => void;
    }
  ).flush;
  if (typeof flush !== "function") return Promise.resolve();

  return new Promise((resolve, reject) => {
    flush.call(stream, (error) => (error ? reject(error) : resolve()));
  });
};

export async function createLoggingRuntime(
  env: Env,
  options: CreateLoggingRuntimeOptions = {},
): Promise<LoggingRuntime> {
  const destination = await (options.createDestination ?? createLogDestination)(env);
  const isDevelopment = env.NODE_ENV === "development";
  const prettyStream = isDevelopment
    ? options.consoleStream ??
      options.createPrettyStream?.() ??
      pinoPretty({ colorize: true, sync: true })
    : undefined;
  const ownsPrettyStream = isDevelopment && options.consoleStream === undefined;
  const multistream = prettyStream
    ? pino.multistream([
        { stream: prettyStream },
        { stream: destination.stream },
      ])
    : undefined;
  const output = multistream ?? destination.stream;
  const rootLogger = pino(
    {
      level: env.LOG_LEVEL,
      base: { service: "@skillstream/api", environment: env.NODE_ENV },
      redact: { paths: [...REDACT_PATHS], censor: "[Redacted]" },
      serializers: { err: pino.stdSerializers.err },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    output,
  );
  let closePromise: Promise<void> | undefined;

  return {
    logger: new NestPinoLogger(rootLogger),
    close: () => {
      closePromise ??= (async () => {
        await new Promise<void>((resolve, reject) => {
          rootLogger.flush((error) => {
            if (error) {
              reject(error);
              return;
            }
            resolve();
          });
        });
        if (multistream && prettyStream) {
          multistream.flushSync();
          await Promise.all(
            [prettyStream, destination.stream].map(flushStream),
          );
          if (ownsPrettyStream) {
            const stream = prettyStream as NodeJS.WritableStream & {
              end: () => void;
              once: (event: string, listener: () => void) => void;
              writableFinished?: boolean;
            };
            if (!stream.writableFinished) {
              await new Promise<void>((resolve, reject) => {
                stream.once("error", reject);
                stream.once("finish", resolve);
                stream.end();
              });
            }
          }
        }
        await destination.close();
      })();
      return closePromise;
    },
  };
}

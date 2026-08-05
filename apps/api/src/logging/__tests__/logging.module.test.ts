import { Inject, Injectable, Module, type LoggerService } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { APP_LOGGER, LOGGING_RUNTIME } from "../logging.constants";
import { LoggingModule } from "../logging.module";
import type { LoggingRuntime } from "../logging.runtime";

@Injectable()
class FeatureLoggerConsumer {
  constructor(@Inject(APP_LOGGER) readonly logger: LoggerService) {}
}

@Module({ providers: [FeatureLoggerConsumer] })
class FeatureModule {}

const fakeLogger: LoggerService = {
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  verbose: vi.fn(),
  fatal: vi.fn(),
};

const createModule = (runtime: LoggingRuntime) =>
  Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        load: [
          () => ({
            NODE_ENV: "test",
            LOG_LEVEL: "info",
            LOG_DESTINATION: "file",
          }),
        ],
      }),
      LoggingModule,
      FeatureModule,
    ],
  })
    .overrideProvider(LOGGING_RUNTIME)
    .useValue(runtime)
    .compile();

describe("LoggingModule", () => {
  it("aliases the application logger and closes its runtime with the module", async () => {
    const runtime: LoggingRuntime = {
      logger: fakeLogger,
      close: vi.fn(async () => undefined),
    };
    const moduleRef = await createModule(runtime);

    expect(moduleRef.get<LoggerService>(APP_LOGGER)).toBe(fakeLogger);
    await moduleRef.close();

    expect(runtime.close).toHaveBeenCalledOnce();
  });

  it("makes APP_LOGGER available to feature modules without logging imports", async () => {
    const runtime: LoggingRuntime = {
      logger: fakeLogger,
      close: vi.fn(async () => undefined),
    };
    const moduleRef = await createModule(runtime);

    expect(moduleRef.get(FeatureLoggerConsumer).logger).toBe(fakeLogger);

    await moduleRef.close();
  });

});

import {
  Global,
  Inject,
  Injectable,
  Module,
  type LoggerService,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../config/env";
import { APP_LOGGER, LOGGING_RUNTIME } from "./logging.constants";
import {
  createLoggingRuntime,
  type LoggingRuntime,
} from "./logging.runtime";

@Injectable()
class LoggingRuntimeLifecycle implements OnApplicationShutdown {
  constructor(
    @Inject(LOGGING_RUNTIME) private readonly runtime: LoggingRuntime,
  ) {}

  onApplicationShutdown(): Promise<void> {
    return this.runtime.close();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: LOGGING_RUNTIME,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        createLoggingRuntime({
          NODE_ENV: config.getOrThrow("NODE_ENV", { infer: true }),
          LOG_LEVEL: config.getOrThrow("LOG_LEVEL", { infer: true }),
          LOG_DESTINATION: config.getOrThrow("LOG_DESTINATION", {
            infer: true,
          }),
          LOG_DIR: config.getOrThrow("LOG_DIR", { infer: true }),
          LOG_RETENTION_DAYS: config.getOrThrow("LOG_RETENTION_DAYS", {
            infer: true,
          }),
        } as Env),
    },
    {
      provide: APP_LOGGER,
      inject: [LOGGING_RUNTIME],
      useFactory: (runtime: LoggingRuntime): LoggerService => runtime.logger,
    },
    LoggingRuntimeLifecycle,
  ],
  exports: [APP_LOGGER],
})
export class LoggingModule {}

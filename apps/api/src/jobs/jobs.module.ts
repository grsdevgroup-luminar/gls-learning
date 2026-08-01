import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../config/env";
import { AutomationService } from "./automation.service";
import { FxService } from "./fx.service";
import { MaintenanceProcessor } from "./maintenance.processor";
import { MaintenanceScheduler } from "./maintenance.scheduler";
import { NotificationsProcessor } from "./notifications.processor";
import { AutomationRepository } from "./automation.repository";
import { FxRepository } from "./fx.repository";
import { MaintenanceRepository } from "./maintenance.repository";
import { NotificationsRepository } from "./notifications.repository";
import { MAINTENANCE_QUEUE, NOTIFICATIONS_QUEUE } from "./jobs.constants";

function parseRedis(url: string | undefined) {
  const base = { maxRetriesPerRequest: null as null };
  try {
    const u = new URL(url ?? "redis://localhost:6379");
    return {
      ...base,
      host: u.hostname,
      port: Number(u.port || 6379),
      username: u.username ? decodeURIComponent(u.username) : undefined,
      password: u.password ? decodeURIComponent(u.password) : undefined,
      // Managed Redis (e.g. Upstash) uses TLS via the rediss:// scheme.
      tls: u.protocol === "rediss:" ? {} : undefined,
    };
  } catch {
    return { ...base, host: "localhost", port: 6379 };
  }
}

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        connection: parseRedis(config.get("REDIS_URL", { infer: true })),
      }),
    }),
    BullModule.registerQueue(
      { name: MAINTENANCE_QUEUE },
      { name: NOTIFICATIONS_QUEUE },
    ),
  ],
  providers: [
    AutomationService,
    FxService,
    MaintenanceProcessor,
    MaintenanceScheduler,
    NotificationsProcessor,
    AutomationRepository,
    FxRepository,
    MaintenanceRepository,
    NotificationsRepository,
  ],
})
export class JobsModule {}

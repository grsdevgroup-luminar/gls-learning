import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Queue } from "bullmq";
import { MAINTENANCE_QUEUE } from "./jobs.constants";

/** Registers the repeatable maintenance rollup and runs one pass on boot. */
@Injectable()
export class MaintenanceScheduler implements OnModuleInit {
  private readonly logger = new Logger(MaintenanceScheduler.name);

  constructor(
    @InjectQueue(MAINTENANCE_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.queue.add(
        "rollup",
        {},
        {
          repeat: { every: 60 * 60 * 1000 }, // hourly
          jobId: "maintenance-rollup", // dedupes the repeatable
          removeOnComplete: 50,
          removeOnFail: 50,
        },
      );
      // Marketing automation: evaluate rules hourly and enqueue reminders.
      await this.queue.add(
        "automation-sweep",
        {},
        {
          repeat: { every: 60 * 60 * 1000 },
          jobId: "automation-sweep",
          removeOnComplete: 50,
          removeOnFail: 50,
        },
      );
      // FX rates: display-only, and the bank's own spread dwarfs a day of
      // drift — daily is plenty, and it keeps us well inside the free feed's
      // rate limit.
      await this.queue.add(
        "fx-refresh",
        {},
        {
          repeat: { every: 24 * 60 * 60 * 1000 },
          jobId: "fx-refresh",
          removeOnComplete: 50,
          removeOnFail: 50,
        },
      );
      // Kick one off immediately so fresh deploys reconcile right away.
      await this.queue.add("rollup", {}, { removeOnComplete: true });
      // Ditto for FX: a repeatable's first run is one interval away, which would
      // leave a fresh deploy on seeded rates for 24h.
      await this.queue.add("fx-refresh", {}, { removeOnComplete: true });
    } catch (err) {
      this.logger.warn(
        `Could not schedule maintenance job (is Redis up?): ${(err as Error).message}`,
      );
    }
  }
}

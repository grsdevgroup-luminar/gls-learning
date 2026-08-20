import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { LocalDriver } from "./drivers/local.driver";
import { S3Driver } from "./drivers/s3.driver";
import type { StorageDriver } from "./storage.driver";
import type { Env } from "../../config/env";

/**
 * Picks the storage backend at boot. Env.ts already defaults STORAGE_DRIVER to
 * `s3` in production and `local` elsewhere, so this class exists mainly to
 * keep the wiring symmetric — new drivers slot in with a single case.
 */
@Injectable()
export class StorageFactory {
  private readonly logger = new Logger(StorageFactory.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  create(): StorageDriver {
    const driver = this.config.get("STORAGE_DRIVER", { infer: true });
    this.logger.log(`Storage driver: ${driver}`);
    if (driver === "s3") return new S3Driver(this.config);
    return new LocalDriver(this.config);
  }
}

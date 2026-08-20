import { Module } from "@nestjs/common";
import { StorageFactory } from "./storage.factory";
import { STORAGE_DRIVER } from "./storage.constants";
import type { StorageDriver } from "./storage.driver";

/**
 * Registers a single `StorageDriver` instance chosen by StorageFactory. Modules
 * that need to read/write files inject the `STORAGE_DRIVER` token — the
 * concrete implementation stays hidden.
 */
@Module({
  providers: [
    StorageFactory,
    {
      provide: STORAGE_DRIVER,
      useFactory: (factory: StorageFactory): StorageDriver => factory.create(),
      inject: [StorageFactory],
    },
  ],
  exports: [STORAGE_DRIVER],
})
export class StorageModule {}

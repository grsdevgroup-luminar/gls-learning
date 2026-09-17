import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { StorageModule } from "../storage/storage.module";
import { DeliveryPartnerController } from "./delivery-partner.controller";
import { DeliveryPartnerService } from "./delivery-partner.service";
import { DeliveryPartnerRepository } from "./delivery-partner.repository";

@Module({
  imports: [NotificationsModule, StorageModule],
  controllers: [DeliveryPartnerController],
  providers: [DeliveryPartnerService, DeliveryPartnerRepository],
  exports: [DeliveryPartnerService],
})
export class DeliveryPartnerModule {}

import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { OrganizationsController } from "./organizations.controller";
import { OrganizationsService } from "./organizations.service";
import { OrganizationsRepository } from "./organizations.repository";

@Module({
  imports: [AdminModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrganizationsRepository],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}

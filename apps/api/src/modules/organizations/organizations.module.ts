import { forwardRef, Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { OrganizationsController } from "./organizations.controller";
import { OrganizationsService } from "./organizations.service";
import { OrganizationsRepository } from "./organizations.repository";

@Module({
  // forwardRef: AdminModule now also imports OrganizationsModule (to
  // delegate the platform-admin student-memberships/restore endpoints to
  // OrganizationsService) — this and AdminModule's matching forwardRef break
  // that cycle.
  imports: [forwardRef(() => AdminModule)],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrganizationsRepository],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}

import { Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  categoryProposalSchema,
  createCategorySchema,
  updateCategorySchema,
  type CategoryProposalInput,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from "@skillstream/shared";
import { CurrentUser, Public, Roles, type RequestUser } from "../../common/decorators/decorators";
import { ZodBody } from "../../common/utils/swagger";
import { CategoriesService } from "./categories.service";

@ApiTags("categories")
@Controller()
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Public()
  @Get("categories")
  list() {
    return this.categories.activeNames();
  }

  @ApiBearerAuth()
  @Roles("INSTRUCTOR", "ADMIN")
  @Post("categories/proposals")
  propose(
    @CurrentUser() user: RequestUser,
    @ZodBody(categoryProposalSchema) body: CategoryProposalInput,
  ) {
    return this.categories.propose(body, user);
  }

  @ApiBearerAuth()
  @Roles("ADMIN")
  @Get("admin/categories")
  adminList() {
    return this.categories.adminList();
  }

  @ApiBearerAuth()
  @Roles("ADMIN")
  @Post("admin/categories")
  adminCreate(@ZodBody(createCategorySchema) body: CreateCategoryInput) {
    return this.categories.createByAdmin(body);
  }

  @ApiBearerAuth()
  @Roles("ADMIN")
  @Patch("admin/categories/:id")
  adminUpdate(
    @Param("id") id: string,
    @ZodBody(updateCategorySchema) body: UpdateCategoryInput,
  ) {
    return this.categories.updateByAdmin(id, body);
  }

  @ApiBearerAuth()
  @Roles("ADMIN")
  @Delete("admin/categories/:id")
  adminRemove(@Param("id") id: string) {
    return this.categories.removeByAdmin(id);
  }
}

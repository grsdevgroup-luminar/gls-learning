import { Controller, Get, Patch } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  updateLearningPreferencesSchema,
  type UpdateLearningPreferencesInput,
} from "@skillstream/shared";
import { CurrentUser, type RequestUser } from "../../common/decorators/decorators";
import { ZodBody } from "../../common/utils/swagger";
import { UsersService } from "./users.service";

/** Course interests are saved from the compact sign-up modal. */
@ApiTags("course preferences")
@ApiBearerAuth()
@Controller("me/course-preferences")
export class LearningPreferencesController {
  constructor(private readonly users: UsersService) {}

  @Get()
  get(@CurrentUser() user: RequestUser) {
    return this.users.learningPreferences(user.id);
  }

  @Patch()
  update(
    @CurrentUser() user: RequestUser,
    @ZodBody(updateLearningPreferencesSchema) body: UpdateLearningPreferencesInput,
  ) {
    return this.users.updateLearningPreferences(user.id, body);
  }
}

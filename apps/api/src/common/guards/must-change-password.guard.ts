import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  ALLOW_PENDING_PASSWORD_CHANGE_KEY,
  IS_PUBLIC_KEY,
  type RequestUser,
} from "../decorators/decorators";

/**
 * Blocks every route for a user flagged `mustChangePassword` except @Public()
 * and @AllowPendingPasswordChange() routes (the identity check and the
 * force-password-change endpoint itself). Runs after JwtAuthGuard, so
 * `req.user` is already populated when this fires.
 */
@Injectable()
export class MustChangePasswordGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const exempt = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    ) ||
      this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_PASSWORD_CHANGE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
    if (exempt) return true;

    const user = context.switchToHttp().getRequest().user as
      | RequestUser
      | undefined;
    if (user?.mustChangePassword)
      throw new ForbiddenException("You must set a new password before continuing");
    return true;
  }
}

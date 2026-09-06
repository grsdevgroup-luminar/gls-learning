import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from "@nestjs/common";
import type { UserRole } from "@skillstream/shared";

/** Authenticated request user attached by JwtStrategy.validate(). */
export interface RequestUser {
  id: string;
  email: string;
  role: UserRole;
  mustChangePassword: boolean;
}

/** Marks a route as public (skips JwtAuthGuard). */
export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Marks a route reachable even while the caller's account is flagged
 *  `mustChangePassword` — otherwise MustChangePasswordGuard blocks it. Only
 *  the identity check and the force-password-change endpoint itself need this. */
export const ALLOW_PENDING_PASSWORD_CHANGE_KEY = "allowPendingPasswordChange";
export const AllowPendingPasswordChange = () =>
  SetMetadata(ALLOW_PENDING_PASSWORD_CHANGE_KEY, true);

/** Restricts a route to the given roles (enforced by RolesGuard). */
export const ROLES_KEY = "roles";
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/** Injects the authenticated user: `@CurrentUser() user: RequestUser`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as RequestUser;
  },
);

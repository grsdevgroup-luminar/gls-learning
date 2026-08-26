import { ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import { IS_PUBLIC_KEY } from "../decorators/decorators";

/**
 * Global JWT guard. Routes annotated with @Public() don't require a token,
 * but the passport strategy still runs — a present, valid token is decoded
 * and attached to `req.user` like normal. This makes @Public() mean "auth
 * optional", not "auth skipped": a route can be reachable by anyone while
 * still reading `@CurrentUser() user: RequestUser | undefined` to behave
 * differently for a logged-in caller (e.g. lesson playback — free preview
 * for anonymous visitors, enrollment-gated for everyone else).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  private isPublic(context: ExecutionContext): boolean {
    return !!this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  }

  override canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  override handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser,
    info: unknown,
    context: ExecutionContext,
  ): TUser {
    // Public: a missing or invalid token just means an anonymous caller —
    // never throw. Everywhere else, keep passport's normal "401 on failure".
    if (this.isPublic(context)) return user;
    return super.handleRequest(err, user, info, context);
  }
}

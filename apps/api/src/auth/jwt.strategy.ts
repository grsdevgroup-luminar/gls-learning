import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { Request } from "express";
import { UsersService } from "../users/users.service";
import type { RequestUser } from "../common/decorators";
import type { Env } from "../config/env";
import type { JwtPayload } from "./token.service";

/** Reads the access token from the httpOnly `access_token` cookie first, then
 *  falls back to the Authorization: Bearer header. */
function cookieOrBearerExtractor(req: Request): string | null {
  const fromCookie = (req.cookies as Record<string, string> | undefined)
    ?.access_token;
  if (fromCookie) return fromCookie;
  return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService<Env, true>,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: cookieOrBearerExtractor,
      ignoreExpiration: false,
      secretOrKey: config.get("JWT_ACCESS_SECRET", { infer: true }),
    });
  }

  async validate(payload: JwtPayload): Promise<RequestUser> {
    const user = await this.users.findById(payload.sub);
    if (!user) throw new UnauthorizedException();
    return { id: user.id, email: user.email, role: user.role };
  }
}

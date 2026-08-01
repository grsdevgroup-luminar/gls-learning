import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import { ApiTags } from "@nestjs/swagger";
import type { CookieOptions, Request, Response } from "express";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
  type AuthTokensDto,
  type ChangePasswordInput,
  type ForgotPasswordInput,
  type LoginInput,
  type RegisterInput,
  type ResetPasswordInput,
  type UpdateProfileInput,
} from "@skillstream/shared";
import { ZodBody } from "../common/swagger";
import { CurrentUser, Public, type RequestUser } from "../common/decorators";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import type { Env } from "../config/env";
import { AuthService, type SessionMeta } from "./auth.service";

const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private metaFrom(req: Request): SessionMeta {
    return { userAgent: req.headers["user-agent"], ip: req.ip };
  }

  private baseCookie(): CookieOptions {
    const isProd = this.config.get("NODE_ENV", { infer: true }) === "production";
    const domain = this.config.get("COOKIE_DOMAIN", { infer: true });
    return {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      domain: domain || undefined,
      path: "/",
    };
  }

  private setAuthCookies(
    res: Response,
    tokens: { accessToken: string; refreshToken: string; expiresIn: number },
  ): void {
    res.cookie(ACCESS_COOKIE, tokens.accessToken, {
      ...this.baseCookie(),
      maxAge: tokens.expiresIn * 1000,
    });
    const days = this.config.get("JWT_REFRESH_TTL_DAYS", { infer: true });
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      ...this.baseCookie(),
      maxAge: days * 86_400_000,
    });
  }

  private clearAuthCookies(res: Response): void {
    const opts = this.baseCookie();
    res.clearCookie(ACCESS_COOKIE, opts);
    res.clearCookie(REFRESH_COOKIE, opts);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("register")
  async register(
    @ZodBody(registerSchema) body: RegisterInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokensDto> {
    const tokens = await this.auth.register(body, this.metaFrom(req));
    this.setAuthCookies(res, tokens);
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }

  @Public()
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post("login")
  @HttpCode(200)
  async login(
    @ZodBody(loginSchema) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokensDto> {
    const tokens = await this.auth.login(body, this.metaFrom(req));
    this.setAuthCookies(res, tokens);
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }

  @Public()
  @Post("refresh")
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokensDto> {
    const raw = (req.cookies as Record<string, string> | undefined)?.[
      REFRESH_COOKIE
    ];
    const tokens = await this.auth.refresh(raw, this.metaFrom(req));
    this.setAuthCookies(res, tokens);
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }

  @Public()
  @Post("logout")
  @HttpCode(200)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    const raw = (req.cookies as Record<string, string> | undefined)?.[
      REFRESH_COOKIE
    ];
    await this.auth.logout(raw);
    this.clearAuthCookies(res);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@CurrentUser() user: RequestUser) {
    return this.auth.me(user.id);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post("forgot-password")
  @HttpCode(200)
  forgotPassword(
    @ZodBody(forgotPasswordSchema) body: ForgotPasswordInput,
  ) {
    return this.auth.forgotPassword(body);
  }

  @Public()
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post("reset-password")
  @HttpCode(200)
  resetPassword(
    @ZodBody(resetPasswordSchema) body: ResetPasswordInput,
  ) {
    return this.auth.resetPassword(body);
  }

  @Patch("me/profile")
  updateProfile(
    @CurrentUser() user: RequestUser,
    @ZodBody(updateProfileSchema) body: UpdateProfileInput,
  ) {
    return this.auth.updateProfile(user.id, body);
  }

  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post("me/password")
  @HttpCode(200)
  changePassword(
    @CurrentUser() user: RequestUser,
    @ZodBody(changePasswordSchema) body: ChangePasswordInput,
  ) {
    return this.auth.changePassword(user.id, body);
  }
}

import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiTags } from "@nestjs/swagger";
import type { CookieOptions, Request, Response } from "express";
import {
  loginSchema,
  registerSchema,
  type AuthTokensDto,
  type LoginInput,
  type RegisterInput,
} from "@skillstream/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
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
  @Post("register")
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokensDto> {
    const tokens = await this.auth.register(body, this.metaFrom(req));
    this.setAuthCookies(res, tokens);
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }

  @Public()
  @Post("login")
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
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
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import * as argon2 from "argon2";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { UserRole } from "@prisma/client";
import type {
  AuthUserDto,
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  UpdateProfileInput,
} from "@skillstream/shared";
import { UsersService } from "../users/users.service";
import { TokenService } from "./token.service";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import type { Env } from "../config/env";

export interface SessionMeta {
  userAgent?: string;
  ip?: string;
}

interface ResetTokenPayload {
  sub: string;
  purpose: "password-reset";
  iat?: number;
}

@Injectable()
export class AuthService {
  private readonly resetSecret: string;

  constructor(
    private readonly users: UsersService,
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {
    this.resetSecret = config.get("JWT_ACCESS_SECRET", { infer: true }) + "_reset";
  }

  async register(input: RegisterInput, meta: SessionMeta) {
    const existing = await this.users.findByEmail(input.email);
    if (existing) throw new ConflictException("Email already registered");

    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
    });
    const user = await this.users.create({
      email: input.email.toLowerCase(),
      name: input.name,
      country: input.country,
      passwordHash,
      role: "STUDENT",
      studentProfile: { create: {} },
    });
    // Fire welcome email (non-blocking — don't fail registration on email error).
    this.email.sendWelcome(user.email, user.name).catch(() => {});
    return this.issueSession(user.id, user.email, user.role, meta);
  }

  async login(input: LoginInput, meta: SessionMeta) {
    const user = await this.users.findByEmail(input.email);
    if (!user) throw new UnauthorizedException("Invalid credentials");
    const valid = await argon2.verify(user.passwordHash, input.password);
    if (!valid) throw new UnauthorizedException("Invalid credentials");
    return this.issueSession(user.id, user.email, user.role, meta);
  }

  async refresh(rawRefreshToken: string | undefined, meta: SessionMeta) {
    if (!rawRefreshToken) throw new UnauthorizedException("Missing refresh token");
    const rotated = await this.tokens.rotateRefreshToken(rawRefreshToken, meta);
    if (!rotated) throw new UnauthorizedException("Invalid refresh token");
    const user = await this.users.findById(rotated.userId);
    if (!user) throw new UnauthorizedException();
    const accessToken = this.tokens.signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    return {
      accessToken,
      refreshToken: rotated.newToken,
      expiresIn: this.tokens.accessTtlSeconds,
    };
  }

  async logout(rawRefreshToken: string | undefined) {
    if (rawRefreshToken) await this.tokens.revokeRefreshToken(rawRefreshToken);
  }

  async me(userId: string): Promise<AuthUserDto> {
    const user = await this.users.findWithProfiles(userId);
    if (!user) throw new UnauthorizedException();
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      country: user.country,
      role: user.role,
      emailVerified: user.emailVerified,
      instructorStatus: user.instructorProfile?.status ?? null,
    };
  }

  async forgotPassword(input: ForgotPasswordInput): Promise<{ ok: true }> {
    const user = await this.users.findByEmail(input.email);
    // Always return ok to prevent email enumeration.
    if (!user) return { ok: true };

    const token = this.jwt.sign(
      { sub: user.id, purpose: "password-reset" } satisfies ResetTokenPayload,
      { secret: this.resetSecret, expiresIn: "1h" },
    );
    await this.email.sendPasswordReset(user.email, user.name, token);
    return { ok: true };
  }

  async resetPassword(input: ResetPasswordInput): Promise<{ ok: true }> {
    let payload: ResetTokenPayload;
    try {
      payload = this.jwt.verify<ResetTokenPayload>(input.token, {
        secret: this.resetSecret,
      });
    } catch {
      throw new BadRequestException("Invalid or expired reset token");
    }
    if (payload.purpose !== "password-reset")
      throw new BadRequestException("Invalid token purpose");

    const user = await this.users.findById(payload.sub);
    if (!user) throw new NotFoundException("User not found");

    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    // Revoke all existing sessions so old sessions can't be reused.
    await this.prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    return { ok: true };
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<AuthUserDto> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: input.name,
        avatar: input.avatar ?? undefined,
        country: input.country ?? undefined,
      },
    });
    return this.me(userId);
  }

  async changePassword(userId: string, input: ChangePasswordInput): Promise<{ ok: true }> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    const valid = await argon2.verify(user.passwordHash, input.currentPassword);
    if (!valid) throw new BadRequestException("Current password is incorrect");
    const passwordHash = await argon2.hash(input.newPassword, { type: argon2.argon2id });
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    return { ok: true };
  }

  private async issueSession(
    userId: string,
    email: string,
    role: UserRole,
    meta: SessionMeta,
  ) {
    const accessToken = this.tokens.signAccessToken({ sub: userId, email, role });
    const refreshToken = await this.tokens.issueRefreshToken(userId, meta);
    return {
      accessToken,
      refreshToken,
      expiresIn: this.tokens.accessTtlSeconds,
    };
  }
}

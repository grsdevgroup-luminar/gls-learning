import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import * as argon2 from "argon2";
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
import { AuthRepository } from "./auth.repository";
import { EmailService } from "../email/email.service";

export interface SessionMeta {
  userAgent?: string;
  ip?: string;
}

// Verified against a real argon2id hash even when the account doesn't exist,
// so a login attempt against an unknown email takes the same time as a wrong
// password on a known one (otherwise the branch is a timing side-channel that
// lets an attacker enumerate registered emails).
const DUMMY_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$qG3iYM79HzmML4nYYbNiIw$wQtTB/quYQc5M3BK7ciJ5h0BoT7NJzD3fCT+t+2Ra3g";

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly tokens: TokenService,
    private readonly repo: AuthRepository,
    private readonly email: EmailService,
  ) {}

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
    const valid = await argon2.verify(user?.passwordHash ?? DUMMY_HASH, input.password);
    if (!user || !valid) throw new UnauthorizedException("Invalid credentials");
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
      phone: user.phone,
      role: user.role,
      emailVerified: user.emailVerified,
      instructorStatus: user.instructorProfile?.status ?? null,
    };
  }

  async forgotPassword(input: ForgotPasswordInput): Promise<{ ok: true }> {
    const user = await this.users.findByEmail(input.email);
    // Always return ok to prevent email enumeration.
    if (!user) return { ok: true };

    const token = await this.tokens.issuePasswordResetToken(user.id);
    await this.email.sendPasswordReset(user.email, user.name, token);
    return { ok: true };
  }

  async resetPassword(input: ResetPasswordInput): Promise<{ ok: true }> {
    // Single-use, DB-backed token: consuming it here means a captured/replayed
    // link can never reset the password a second time, unlike a stateless JWT.
    const userId = await this.tokens.consumePasswordResetToken(input.token);
    if (!userId) throw new BadRequestException("Invalid or expired reset token");

    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    await this.repo.updateUserPassword(userId, passwordHash);
    // Revoke all existing sessions so old sessions can't be reused.
    await this.repo.deleteRefreshTokensByUser(userId);
    return { ok: true };
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<AuthUserDto> {
    // `?? undefined` would swallow an explicit null, leaving no way to clear
    // a field the schema declares nullable — only an absent key means "leave".
    await this.repo.updateUserProfile(userId, {
      name: input.name,
      ...(input.avatar !== undefined ? { avatar: input.avatar } : {}),
      ...(input.country !== undefined ? { country: input.country } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
    });
    return this.me(userId);
  }

  async changePassword(userId: string, input: ChangePasswordInput): Promise<{ ok: true }> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    const valid = await argon2.verify(user.passwordHash, input.currentPassword);
    if (!valid) throw new BadRequestException("Current password is incorrect");
    const passwordHash = await argon2.hash(input.newPassword, { type: argon2.argon2id });
    await this.repo.updateUserPassword(userId, passwordHash);
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

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import * as argon2 from "argon2";
import { UserRole } from "@prisma/client";
import { ulid } from "ulid";
import { normalizeEmail } from "@skillstream/shared";
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
import {
  AVATAR_KEY_PREFIX,
  STORAGE_DRIVER,
} from "../storage/storage.constants";
import type { StorageDriver } from "../storage/storage.driver";
import type { ValidatedAvatarFile } from "./pipes/avatar-file.pipe";

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
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly tokens: TokenService,
    private readonly repo: AuthRepository,
    private readonly email: EmailService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
  ) {}

  async register(input: RegisterInput, meta: SessionMeta) {
    const email = normalizeEmail(input.email);
    const existing = await this.users.findByEmail(email);
    if (existing) throw new ConflictException("Email already registered");

    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
    });
    const user = await this.users.create({
      email,
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
    const user = await this.users.findByEmail(normalizeEmail(input.email));
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
    // Platform-uploaded avatars: re-resolve via the storage driver so signed S3
    // URLs are always fresh. External URLs (avatar without avatarKey) are
    // passed through unchanged so legacy rows keep working.
    const avatar = user.avatarKey
      ? await this.storage.getUrl(user.avatarKey).catch((err) => {
          this.logger.warn(
            `Failed to resolve avatar key ${user.avatarKey}: ${(err as Error).message}`,
          );
          return user.avatar;
        })
      : user.avatar;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar,
      country: user.country,
      phone: user.phone,
      role: user.role,
      emailVerified: user.emailVerified,
      instructorStatus: user.instructorProfile?.status ?? null,
    };
  }

  async forgotPassword(input: ForgotPasswordInput): Promise<{ ok: true }> {
    const user = await this.users.findByEmail(normalizeEmail(input.email));
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
    // When `avatar` is set explicitly the caller is choosing an external URL
    // (or clearing) — either way any previous platform-uploaded object is now
    // orphaned. Drop the storage handle so /me stops trying to re-sign it,
    // and best-effort delete the underlying object.
    let previousAvatarKey: string | null = null;
    if (input.avatar !== undefined) {
      const current = await this.users.findById(userId);
      previousAvatarKey = current?.avatarKey ?? null;
    }
    await this.repo.updateUserProfile(userId, {
      name: input.name,
      ...(input.avatar !== undefined ? { avatar: input.avatar, avatarKey: null } : {}),
      ...(input.country !== undefined ? { country: input.country } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
    });
    if (previousAvatarKey) {
      await this.storage.delete(previousAvatarKey).catch((err) => {
        this.logger.warn(
          `Failed to delete previous avatar ${previousAvatarKey}: ${(err as Error).message}`,
        );
      });
    }
    return this.me(userId);
  }

  async uploadAvatar(
    userId: string,
    file: ValidatedAvatarFile,
  ): Promise<AuthUserDto> {
    // Key layout mirrors lesson resources: `avatars/{userId}/{ulid}.{ext}` —
    // same shape for local + S3 so swapping the driver never rewrites the DB.
    const key = `${AVATAR_KEY_PREFIX}/${userId}/${ulid()}.${file.extension}`;
    const stored = await this.storage.put({
      key,
      body: file.buffer,
      contentType: file.mimeType,
      contentLength: file.size,
      originalName: file.originalName,
      disposition: "inline",
    });

    // Read the current key before overwriting so the previous object can be
    // reaped. Cheap — findById is a single indexed lookup.
    const current = await this.users.findById(userId);
    const previousKey = current?.avatarKey ?? null;

    await this.repo.updateUserProfile(userId, {
      avatar: stored.url,
      avatarKey: stored.key,
    });

    if (previousKey && previousKey !== stored.key) {
      // Best-effort — a leftover object costs pennies, but never surface it
      // to the user because their DB row is already updated.
      await this.storage.delete(previousKey).catch((err) => {
        this.logger.warn(
          `Failed to delete previous avatar ${previousKey}: ${(err as Error).message}`,
        );
      });
    }

    return this.me(userId);
  }

  async deleteAvatar(userId: string): Promise<AuthUserDto> {
    const current = await this.users.findById(userId);
    if (!current) throw new UnauthorizedException();
    const previousKey = current.avatarKey;
    await this.repo.updateUserProfile(userId, {
      avatar: null,
      avatarKey: null,
    });
    if (previousKey) {
      await this.storage.delete(previousKey).catch((err) => {
        this.logger.warn(
          `Failed to delete avatar ${previousKey}: ${(err as Error).message}`,
        );
      });
    }
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

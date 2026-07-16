import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { UserRole } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import type { Env } from "../config/env";

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
  ) {}

  get accessTtl(): string {
    return this.config.get("JWT_ACCESS_TTL", { infer: true });
  }

  /** Access-token TTL expressed in seconds (for client `expiresIn`). */
  get accessTtlSeconds(): number {
    const ttl = this.accessTtl;
    const m = /^(\d+)([smhd])$/.exec(ttl);
    if (!m) return 900;
    const n = Number(m[1]);
    const unit = m[2];
    return n * { s: 1, m: 60, h: 3600, d: 86400 }[unit]!;
  }

  signAccessToken(payload: JwtPayload): string {
    return this.jwt.sign(payload, {
      secret: this.config.get("JWT_ACCESS_SECRET", { infer: true }),
      // accessTtl is a vercel/ms-style duration string (e.g. "15m"); the jwt
      // typings expect their narrow StringValue template type.
      expiresIn: this.accessTtl as unknown as number,
    });
  }

  private hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  /** Issues a new opaque refresh token, persisting only its hash. */
  async issueRefreshToken(
    userId: string,
    meta: { userAgent?: string; ip?: string },
  ): Promise<string> {
    const raw = randomBytes(48).toString("base64url");
    const days = this.config.get("JWT_REFRESH_TTL_DAYS", { infer: true });
    const expiresAt = new Date(Date.now() + days * 86_400_000);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hash(raw),
        userAgent: meta.userAgent,
        ip: meta.ip,
        expiresAt,
      },
    });
    return raw;
  }

  /**
   * Validates a refresh token and rotates it (single-use). Returns the userId,
   * or null if invalid/expired/revoked. Reuse of an already-rotated token is
   * impossible because the row is deleted on rotation.
   */
  async rotateRefreshToken(
    raw: string,
    meta: { userAgent?: string; ip?: string },
  ): Promise<{ userId: string; newToken: string } | null> {
    const tokenHash = this.hash(raw);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
      return null;
    }
    // Rotate: delete old, issue new in a transaction.
    await this.prisma.refreshToken.delete({ where: { tokenHash } });
    const newToken = await this.issueRefreshToken(existing.userId, meta);
    return { userId: existing.userId, newToken };
  }

  async revokeRefreshToken(raw: string): Promise<void> {
    const tokenHash = this.hash(raw);
    await this.prisma.refreshToken.deleteMany({ where: { tokenHash } });
  }

  /** Issues an opaque, single-use password-reset token (1h TTL). Only its hash
   *  is persisted, matching the refresh-token pattern. */
  async issuePasswordResetToken(userId: string): Promise<string> {
    const raw = randomBytes(32).toString("base64url");
    await this.prisma.passwordResetToken.create({
      data: {
        userId,
        tokenHash: this.hash(raw),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    return raw;
  }

  /**
   * Validates a password-reset token and immediately marks it used so it
   * cannot be replayed, even if intercepted. Returns the userId or null.
   */
  async consumePasswordResetToken(raw: string): Promise<string | null> {
    const tokenHash = this.hash(raw);
    // Atomic claim: the usedAt: null condition means a concurrent replay of
    // the same raw token can never both succeed (no TOCTOU window).
    const { count } = await this.prisma.passwordResetToken.updateMany({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (count === 0) return null;
    const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    return record?.userId ?? null;
  }
}

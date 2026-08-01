import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { UserRole } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { AuthRepository } from "./auth.repository";
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
    private readonly repo: AuthRepository,
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
    await this.repo.createRefreshToken({
      userId,
      tokenHash: this.hash(raw),
      userAgent: meta.userAgent,
      ip: meta.ip,
      expiresAt,
    });
    return raw;
  }

  /** How long a just-rotated token may still be presented without tripping reuse
   *  detection. Covers benign races (two tabs refresh at once before the new
   *  Set-Cookie lands); beyond it, re-presentation means the token was captured.
   *  ponytail: a thief who replays within the grace window looks benign — the
   *  standard rotation/reuse tradeoff; shrink the window to tighten it. */
  private readonly REUSE_GRACE_MS = 60_000;

  /**
   * Validates a refresh token and rotates it (single-use). Returns the userId,
   * or null if invalid/expired/revoked. Old rows are kept and marked revoked so
   * a *reused* (already-rotated) token can be detected: presented after the
   * grace window, it revokes every session for that user (token-theft response).
   */
  async rotateRefreshToken(
    raw: string,
    meta: { userAgent?: string; ip?: string },
  ): Promise<{ userId: string; newToken: string } | null> {
    const tokenHash = this.hash(raw);
    const existing = await this.repo.findRefreshTokenByHash(tokenHash);
    if (!existing) return null;

    if (existing.revokedAt) {
      const age = Date.now() - existing.revokedAt.getTime();
      if (age > this.REUSE_GRACE_MS) {
        // Reuse detected: a token we already rotated away is back. Revoke the
        // whole family (every live session for the user).
        await this.repo.revokeActiveRefreshTokensForUser(
          existing.userId,
          new Date(),
        );
      }
      return null;
    }

    if (existing.expiresAt < new Date()) return null;

    // Atomic rotation: revoke the old row and mint the new one in one transaction
    // so a crash can't leave the user with neither.
    const newRaw = randomBytes(48).toString("base64url");
    const days = this.config.get("JWT_REFRESH_TTL_DAYS", { infer: true });
    await this.prisma.$transaction([
      this.repo.revokeRefreshTokenByHash(tokenHash, new Date()),
      this.repo.createRefreshToken({
        userId: existing.userId,
        tokenHash: this.hash(newRaw),
        userAgent: meta.userAgent,
        ip: meta.ip,
        expiresAt: new Date(Date.now() + days * 86_400_000),
      }),
    ]);
    return { userId: existing.userId, newToken: newRaw };
  }

  async revokeRefreshToken(raw: string): Promise<void> {
    const tokenHash = this.hash(raw);
    await this.repo.deleteRefreshTokensByHash(tokenHash);
  }

  /** Issues an opaque, single-use password-reset token (1h TTL). Only its hash
   *  is persisted, matching the refresh-token pattern. */
  async issuePasswordResetToken(userId: string): Promise<string> {
    const raw = randomBytes(32).toString("base64url");
    await this.repo.createPasswordResetToken({
      userId,
      tokenHash: this.hash(raw),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
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
    const { count } = await this.repo.claimPasswordResetToken(
      tokenHash,
      new Date(),
    );
    if (count === 0) return null;
    const record = await this.repo.findPasswordResetTokenByHash(tokenHash);
    return record?.userId ?? null;
  }
}

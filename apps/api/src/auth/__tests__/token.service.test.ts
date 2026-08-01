import { describe, it, expect, beforeEach } from "vitest";
import { TokenService } from "../token.service";

/** In-memory stand-in for the AuthRepository ops touched by password reset —
 *  enough to prove the single-use claim can't be replayed, without needing a
 *  live Postgres connection. */
function fakeResetRepo() {
  const rows = new Map<string, { userId: string; expiresAt: Date; usedAt: Date | null }>();
  return {
    async createPasswordResetToken(data: {
      userId: string;
      tokenHash: string;
      expiresAt: Date;
    }) {
      rows.set(data.tokenHash, {
        userId: data.userId,
        expiresAt: data.expiresAt,
        usedAt: null,
      });
    },
    async claimPasswordResetToken(tokenHash: string, now: Date) {
      const row = rows.get(tokenHash);
      if (!row || row.usedAt !== null || row.expiresAt <= now) {
        return { count: 0 };
      }
      row.usedAt = now;
      return { count: 1 };
    },
    async findPasswordResetTokenByHash(tokenHash: string) {
      const row = rows.get(tokenHash);
      return row ? { userId: row.userId } : null;
    },
  };
}

interface RefreshRow {
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

/** In-memory AuthRepository covering the RefreshToken ops rotateRefreshToken
 *  touches. */
function fakeRefreshRepo() {
  const rows = new Map<string, RefreshRow>();
  const api = {
    __rows: rows,
    async createRefreshToken(data: {
      userId: string;
      tokenHash: string;
      expiresAt: Date;
      userAgent?: string;
      ip?: string;
    }) {
      rows.set(data.tokenHash, {
        userId: data.userId,
        expiresAt: data.expiresAt,
        revokedAt: null,
      });
    },
    async findRefreshTokenByHash(tokenHash: string) {
      const r = rows.get(tokenHash);
      return r ? { ...r, tokenHash } : null;
    },
    async revokeRefreshTokenByHash(tokenHash: string, at: Date) {
      const r = rows.get(tokenHash);
      if (r) r.revokedAt = at;
    },
    async revokeActiveRefreshTokensForUser(userId: string, at: Date) {
      let count = 0;
      for (const r of rows.values()) {
        if (r.userId === userId && r.revokedAt === null) {
          r.revokedAt = at;
          count += 1;
        }
      }
      return { count };
    },
    async deleteRefreshTokensByHash(tokenHash: string) {
      rows.delete(tokenHash);
    },
  };
  return api;
}

/** Prisma stand-in whose only job is to be the `$transaction` executor. The
 *  fake repo ops are plain promises, so `Promise.all` gives the same atomic
 *  semantics for test purposes. */
const fakePrisma = {
  async $transaction(ops: Promise<unknown>[]) {
    return Promise.all(ops);
  },
};

const fakeConfig = { get: () => 7 };

describe("TokenService refresh-token rotation & reuse detection", () => {
  it("rotates a valid token and rejects the old one", async () => {
    const repo = fakeRefreshRepo();
    const tokens = new TokenService(
      undefined as never,
      fakeConfig as never,
      fakePrisma as never,
      repo as never,
    );
    const raw = await tokens.issueRefreshToken("user_1", {});
    const rotated = await tokens.rotateRefreshToken(raw, {});
    expect(rotated?.userId).toBe("user_1");
    expect(rotated?.newToken).toBeTruthy();
    // Re-presenting the just-rotated token inside the grace window is benign.
    await expect(tokens.rotateRefreshToken(raw, {})).resolves.toBeNull();
  });

  it("revokes every session when a rotated token is reused past the grace window", async () => {
    const repo = fakeRefreshRepo();
    const tokens = new TokenService(
      undefined as never,
      fakeConfig as never,
      fakePrisma as never,
      repo as never,
    );
    const raw = await tokens.issueRefreshToken("user_1", {});
    const rotated = await tokens.rotateRefreshToken(raw, {});
    // Age the old token's revocation past the grace window.
    for (const r of repo.__rows.values()) {
      if (r.revokedAt) r.revokedAt = new Date(Date.now() - 5 * 60_000);
    }
    await expect(tokens.rotateRefreshToken(raw, {})).resolves.toBeNull();
    // Family revoked: the newly-issued token no longer rotates.
    await expect(tokens.rotateRefreshToken(rotated!.newToken, {})).resolves.toBeNull();
  });

  it("rejects an unknown refresh token", async () => {
    const repo = fakeRefreshRepo();
    const tokens = new TokenService(
      undefined as never,
      fakeConfig as never,
      fakePrisma as never,
      repo as never,
    );
    await expect(tokens.rotateRefreshToken("nope", {})).resolves.toBeNull();
  });
});

describe("TokenService password reset tokens", () => {
  let tokens: TokenService;

  beforeEach(() => {
    tokens = new TokenService(
      undefined as never,
      undefined as never,
      fakePrisma as never,
      fakeResetRepo() as never,
    );
  });

  it("consumes a freshly issued token and returns the owning user", async () => {
    const raw = await tokens.issuePasswordResetToken("user_1");
    await expect(tokens.consumePasswordResetToken(raw)).resolves.toBe("user_1");
  });

  it("rejects a second use of the same token (no replay)", async () => {
    const raw = await tokens.issuePasswordResetToken("user_1");
    await tokens.consumePasswordResetToken(raw);
    await expect(tokens.consumePasswordResetToken(raw)).resolves.toBeNull();
  });

  it("rejects an unknown token", async () => {
    await expect(tokens.consumePasswordResetToken("not-a-real-token")).resolves.toBeNull();
  });
});

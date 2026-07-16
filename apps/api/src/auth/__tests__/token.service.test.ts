import { describe, it, expect, beforeEach } from "vitest";
import { TokenService } from "../token.service";

/** In-memory stand-in for the one Prisma table this security-critical path
 *  touches — enough to prove the single-use claim can't be replayed, without
 *  needing a live Postgres connection. */
function fakePrisma() {
  const rows = new Map<string, { userId: string; expiresAt: Date; usedAt: Date | null }>();
  return {
    passwordResetToken: {
      async create({ data }: { data: { userId: string; tokenHash: string; expiresAt: Date } }) {
        rows.set(data.tokenHash, { userId: data.userId, expiresAt: data.expiresAt, usedAt: null });
      },
      async updateMany({
        where,
        data,
      }: {
        where: { tokenHash: string; usedAt: null; expiresAt: { gt: Date } };
        data: { usedAt: Date };
      }) {
        const row = rows.get(where.tokenHash);
        if (!row || row.usedAt !== null || row.expiresAt <= where.expiresAt.gt) {
          return { count: 0 };
        }
        row.usedAt = data.usedAt;
        return { count: 1 };
      },
      async findUnique({ where }: { where: { tokenHash: string } }) {
        const row = rows.get(where.tokenHash);
        return row ? { userId: row.userId } : null;
      },
    },
  };
}

interface RefreshRow {
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

/** In-memory RefreshToken table covering the ops rotateRefreshToken touches. */
function fakeRefreshPrisma() {
  const rows = new Map<string, RefreshRow>();
  const api = {
    __rows: rows,
    refreshToken: {
      async create({
        data,
      }: {
        data: { userId: string; tokenHash: string; expiresAt: Date };
      }) {
        rows.set(data.tokenHash, {
          userId: data.userId,
          expiresAt: data.expiresAt,
          revokedAt: null,
        });
      },
      async findUnique({ where }: { where: { tokenHash: string } }) {
        const r = rows.get(where.tokenHash);
        return r ? { ...r, tokenHash: where.tokenHash } : null;
      },
      async update({
        where,
        data,
      }: {
        where: { tokenHash: string };
        data: { revokedAt: Date };
      }) {
        const r = rows.get(where.tokenHash);
        if (r) r.revokedAt = data.revokedAt;
      },
      async updateMany({
        where,
        data,
      }: {
        where: { userId: string; revokedAt: null };
        data: { revokedAt: Date };
      }) {
        let count = 0;
        for (const r of rows.values()) {
          if (r.userId === where.userId && r.revokedAt === null) {
            r.revokedAt = data.revokedAt;
            count += 1;
          }
        }
        return { count };
      },
    },
    async $transaction(ops: Promise<unknown>[]) {
      return Promise.all(ops);
    },
  };
  return api;
}

const fakeConfig = { get: () => 7 };

describe("TokenService refresh-token rotation & reuse detection", () => {
  it("rotates a valid token and rejects the old one", async () => {
    const db = fakeRefreshPrisma();
    const tokens = new TokenService(undefined as never, fakeConfig as never, db as never);
    const raw = await tokens.issueRefreshToken("user_1", {});
    const rotated = await tokens.rotateRefreshToken(raw, {});
    expect(rotated?.userId).toBe("user_1");
    expect(rotated?.newToken).toBeTruthy();
    // Re-presenting the just-rotated token inside the grace window is benign.
    await expect(tokens.rotateRefreshToken(raw, {})).resolves.toBeNull();
  });

  it("revokes every session when a rotated token is reused past the grace window", async () => {
    const db = fakeRefreshPrisma();
    const tokens = new TokenService(undefined as never, fakeConfig as never, db as never);
    const raw = await tokens.issueRefreshToken("user_1", {});
    const rotated = await tokens.rotateRefreshToken(raw, {});
    // Age the old token's revocation past the grace window.
    for (const r of db.__rows.values()) {
      if (r.revokedAt) r.revokedAt = new Date(Date.now() - 5 * 60_000);
    }
    await expect(tokens.rotateRefreshToken(raw, {})).resolves.toBeNull();
    // Family revoked: the newly-issued token no longer rotates.
    await expect(tokens.rotateRefreshToken(rotated!.newToken, {})).resolves.toBeNull();
  });

  it("rejects an unknown refresh token", async () => {
    const db = fakeRefreshPrisma();
    const tokens = new TokenService(undefined as never, fakeConfig as never, db as never);
    await expect(tokens.rotateRefreshToken("nope", {})).resolves.toBeNull();
  });
});

describe("TokenService password reset tokens", () => {
  let tokens: TokenService;

  beforeEach(() => {
    tokens = new TokenService(
      undefined as never,
      undefined as never,
      fakePrisma() as never,
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

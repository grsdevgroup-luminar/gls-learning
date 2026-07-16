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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnauthorizedException } from "@nestjs/common";
import { AuthService } from "../auth.service";
import type { UsersService } from "../../users/users.service";
import type { TokenService } from "../token.service";
import type { AuthRepository } from "../auth.repository";
import type { EmailService } from "../../email/email.service";
import type { InstructorService } from "../../instructor/instructor.service";
import type { StorageDriver } from "../../storage/storage.driver";

const userId = "user_1";
const dbUser = {
  id: userId,
  email: "orgadmin@techcorp.io",
  role: "ORG_ADMIN" as const,
  passwordHash: "old-hash",
  mustChangePassword: true,
};

function makeService(overrides: {
  users?: Partial<UsersService>;
  repo?: Partial<AuthRepository>;
  tokens?: Partial<TokenService>;
} = {}) {
  const users = {
    findById: vi.fn().mockResolvedValue(dbUser),
    ...overrides.users,
  } as unknown as UsersService;

  const repo = {
    updateUserPassword: vi.fn().mockResolvedValue(undefined),
    clearMustChangePassword: vi.fn().mockResolvedValue(undefined),
    deleteRefreshTokensByUser: vi.fn().mockResolvedValue(undefined),
    ...overrides.repo,
  } as unknown as AuthRepository;

  const tokens = {
    signAccessToken: vi.fn().mockReturnValue("access-token"),
    issueRefreshToken: vi.fn().mockResolvedValue("refresh-token"),
    accessTtlSeconds: 900,
    ...overrides.tokens,
  } as unknown as TokenService;

  const email = {} as EmailService;
  const instructor = {} as InstructorService;
  const storage = {} as StorageDriver;

  return new AuthService(users, tokens, repo, email, instructor, storage);
}

describe("AuthService.forcePasswordChange", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets the new password, clears the flag, and revokes prior sessions", async () => {
    const service = makeService();
    const repoSpy = (service as unknown as { repo: AuthRepository }).repo;

    const result = await service.forcePasswordChange(
      userId,
      { newPassword: "NewStr0ng!Pass" },
      {},
    );

    expect(repoSpy.updateUserPassword).toHaveBeenCalledWith(userId, expect.any(String));
    expect(repoSpy.clearMustChangePassword).toHaveBeenCalledWith(userId);
    expect(repoSpy.deleteRefreshTokensByUser).toHaveBeenCalledWith(userId);
    expect(result.accessToken).toBe("access-token");
  });

  it("hashes the new password rather than storing it in plaintext", async () => {
    const service = makeService();
    const repoSpy = (service as unknown as { repo: AuthRepository }).repo;

    await service.forcePasswordChange(userId, { newPassword: "NewStr0ng!Pass" }, {});

    const [, storedHash] = vi.mocked(repoSpy.updateUserPassword).mock.calls[0];
    expect(storedHash).not.toBe("NewStr0ng!Pass");
    expect(storedHash).toMatch(/^\$argon2id\$/);
  });

  it("rejects when the user no longer exists", async () => {
    const service = makeService({ users: { findById: vi.fn().mockResolvedValue(null) } });

    await expect(
      service.forcePasswordChange(userId, { newPassword: "NewStr0ng!Pass" }, {}),
    ).rejects.toThrow(UnauthorizedException);
  });
});

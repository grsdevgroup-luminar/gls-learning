import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { Db } from "../../common/types";

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  private db(tx?: Db) {
    return tx ?? this.prisma;
  }

  updateUserPassword(userId: string, passwordHash: string, tx?: Db) {
    return this.db(tx).user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  deleteRefreshTokensByUser(userId: string, tx?: Db) {
    return this.db(tx).refreshToken.deleteMany({ where: { userId } });
  }

  updateUserProfile(
    userId: string,
    data: Prisma.UserUpdateInput,
    tx?: Db,
  ) {
    return this.db(tx).user.update({
      where: { id: userId },
      // `?? undefined` would swallow an explicit null, leaving no way to clear
      // a field the schema declares nullable — only an absent key means "leave".
      data,
    });
  }

  createRefreshToken(
    data: Prisma.RefreshTokenUncheckedCreateInput,
    tx?: Db,
  ) {
    return this.db(tx).refreshToken.create({ data });
  }

  findRefreshTokenByHash(tokenHash: string, tx?: Db) {
    return this.db(tx).refreshToken.findUnique({ where: { tokenHash } });
  }

  revokeRefreshTokenByHash(tokenHash: string, revokedAt: Date, tx?: Db) {
    return this.db(tx).refreshToken.update({
      where: { tokenHash },
      data: { revokedAt },
    });
  }

  revokeActiveRefreshTokensForUser(userId: string, revokedAt: Date, tx?: Db) {
    return this.db(tx).refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt },
    });
  }

  deleteRefreshTokensByHash(tokenHash: string, tx?: Db) {
    return this.db(tx).refreshToken.deleteMany({ where: { tokenHash } });
  }

  createPasswordResetToken(
    data: Prisma.PasswordResetTokenUncheckedCreateInput,
    tx?: Db,
  ) {
    return this.db(tx).passwordResetToken.create({ data });
  }

  claimPasswordResetToken(tokenHash: string, now: Date, tx?: Db) {
    // Atomic claim: the usedAt: null condition means a concurrent replay of
    // the same raw token can never both succeed (no TOCTOU window).
    return this.db(tx).passwordResetToken.updateMany({
      where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
  }

  findPasswordResetTokenByHash(tokenHash: string, tx?: Db) {
    return this.db(tx).passwordResetToken.findUnique({ where: { tokenHash } });
  }
}

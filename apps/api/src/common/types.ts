import type { Prisma } from "@prisma/client";
import type { PrismaService } from "../prisma/prisma.service";

/**
 * Prisma client capable of executing queries, either standalone or inside an
 * interactive `$transaction(async (tx) => ...)` block. Repository methods that
 * may be composed inside a caller's transaction accept `Db` as an optional
 * `tx?: Db` param and route through a private `db(tx?)` helper.
 */
export type Db = Prisma.TransactionClient | PrismaService;

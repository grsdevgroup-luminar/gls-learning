/**
 * Creates the first platform admin. Production runs without seed data, so this
 * is the only way to get an account that can open the admin panel.
 *
 *   ADMIN_EMAIL=you@grslearning.dev ADMIN_PASSWORD='...' pnpm --filter @grslearning/api admin:create
 *
 * Refuses to touch an existing account.
 */
import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();
const MIN_PASSWORD_LENGTH = 12;

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || "Platform Admin";

  if (!email || !email.includes("@")) throw new Error("ADMIN_EMAIL is required");
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) throw new Error(`A user with email ${email} already exists`);

  const admin = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      role: "ADMIN",
      emailVerified: true,
    },
    select: { id: true, email: true },
  });

  console.log(`Admin created: ${admin.email} (${admin.id})`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

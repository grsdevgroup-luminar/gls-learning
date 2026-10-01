/** Seeds the admin account, pricing, and automation rules. */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

import { automationRules as mockRules } from "./seed-data/automation";

const prisma = new PrismaClient();

const REMINDER_TRIGGER: Record<string, any> = {
  idle: "IDLE",
  low_progress: "LOW_PROGRESS",
  abandoned_cart: "ABANDONED_CART",
  almost_done: "ALMOST_DONE",
  new_content: "NEW_CONTENT",
};

async function main() {
  // ── Admin ──
  await prisma.user.upsert({
    where: { email: "admin@grslearning.dev" },
    update: {},
    create: {
      email: "admin@grslearning.dev",
      name: "Platform Admin",
      passwordHash: await argon2.hash("admin12345", { type: argon2.argon2id }),
      role: "ADMIN",
      emailVerified: true,
    },
  });

  // ── Pricing tiers / regions / overrides ──
  const pricingTiers = [
    { id: "t1", name: "Tier 1 — High income", multiplier: 1, countries: ["United States", "United Kingdom", "Germany", "Canada", "Australia", "Japan"] },
    { id: "t2", name: "Tier 2 — Middle income", multiplier: 0.7, countries: ["Brazil", "Mexico", "Turkey", "Thailand", "South Africa"] },
    { id: "t3", name: "Tier 3 — Emerging", multiplier: 0.45, countries: ["India", "Bangladesh", "Nigeria", "Pakistan", "Egypt"] },
  ];
  const regions = [
    { code: "US", country: "United States", flag: "🇺🇸", currency: "USD", symbol: "$", locale: "en-US", fxRate: 1, multiplier: 1, tierId: "t1" },
    { code: "GB", country: "United Kingdom", flag: "🇬🇧", currency: "GBP", symbol: "£", locale: "en-GB", fxRate: 0.79, multiplier: 1, tierId: "t1" },
    { code: "DE", country: "Germany", flag: "🇩🇪", currency: "EUR", symbol: "€", locale: "de-DE", fxRate: 0.92, multiplier: 1, tierId: "t1" },
    { code: "CA", country: "Canada", flag: "🇨🇦", currency: "CAD", symbol: "C$", locale: "en-CA", fxRate: 1.37, multiplier: 1, tierId: "t1" },
    { code: "AU", country: "Australia", flag: "🇦🇺", currency: "AUD", symbol: "A$", locale: "en-AU", fxRate: 1.51, multiplier: 1, tierId: "t1" },
    { code: "JP", country: "Japan", flag: "🇯🇵", currency: "JPY", symbol: "¥", locale: "ja-JP", fxRate: 157, multiplier: 1, tierId: "t1" },
    { code: "BR", country: "Brazil", flag: "🇧🇷", currency: "BRL", symbol: "R$", locale: "pt-BR", fxRate: 5.42, multiplier: 0.7, tierId: "t2" },
    { code: "MX", country: "Mexico", flag: "🇲🇽", currency: "MXN", symbol: "MX$", locale: "es-MX", fxRate: 17.1, multiplier: 0.7, tierId: "t2" },
    { code: "TR", country: "Turkey", flag: "🇹🇷", currency: "TRY", symbol: "₺", locale: "tr-TR", fxRate: 32.5, multiplier: 0.7, tierId: "t2" },
    { code: "ZA", country: "South Africa", flag: "🇿🇦", currency: "ZAR", symbol: "R", locale: "en-ZA", fxRate: 18.4, multiplier: 0.7, tierId: "t2" },
    { code: "TH", country: "Thailand", flag: "🇹🇭", currency: "THB", symbol: "฿", locale: "th-TH", fxRate: 36.5, multiplier: 0.7, tierId: "t2" },
    { code: "IN", country: "India", flag: "🇮🇳", currency: "INR", symbol: "₹", locale: "en-IN", fxRate: 83.2, multiplier: 0.35, tierId: "t3", override: true },
    { code: "BD", country: "Bangladesh", flag: "🇧🇩", currency: "BDT", symbol: "৳", locale: "bn-BD", fxRate: 117, multiplier: 0.45, tierId: "t3" },
    { code: "NG", country: "Nigeria", flag: "🇳🇬", currency: "NGN", symbol: "₦", locale: "en-NG", fxRate: 1480, multiplier: 0.45, tierId: "t3" },
    { code: "PK", country: "Pakistan", flag: "🇵🇰", currency: "PKR", symbol: "₨", locale: "ur-PK", fxRate: 278, multiplier: 0.45, tierId: "t3" },
    { code: "EG", country: "Egypt", flag: "🇪🇬", currency: "EGP", symbol: "E£", locale: "ar-EG", fxRate: 48.5, multiplier: 0.45, tierId: "t3" },
  ];
  const countryOverrides = [
    { country: "Bangladesh", flag: "🇧🇩", type: "flat_percent", flatPercent: 45 },
    { country: "India", flag: "🇮🇳", type: "flat_percent", flatPercent: 35 },
  ];
  for (const t of pricingTiers)
    await prisma.pricingTier.upsert({ where: { id: t.id }, update: t, create: t });
  for (const r of regions)
    await prisma.region.upsert({ where: { code: r.code }, update: r, create: r });
  for (const o of countryOverrides)
    await prisma.countryOverride.upsert({ where: { country: o.country }, update: o, create: o });

  // ── Automation rules ──
  for (const r of mockRules) {
    const data = {
      name: r.name,
      trigger: REMINDER_TRIGGER[r.trigger],
      condition: r.condition,
      channels: r.channels.map((ch) => ch.toUpperCase()) as any,
      template: r.template,
      active: r.active,
    };
    await prisma.automationRule.upsert({
      where: { id: r.id },
      update: data,
      // Only initialize cooldown and params on creation; retain admin edits on reseed.
      create: {
        id: r.id,
        ...data,
        sentCount: r.sentCount,
        cooldownHours: r.cooldownHours,
        params: r.params,
      },
    });
  }

  const counts = {
    users: await prisma.user.count(),
  };
  console.log("Seed complete:", counts);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

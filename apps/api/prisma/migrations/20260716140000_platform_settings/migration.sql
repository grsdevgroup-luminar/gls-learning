-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "platformName" TEXT NOT NULL DEFAULT 'SkillStream',
    "supportEmail" TEXT NOT NULL DEFAULT 'support@skillstream.dev',
    "baseCurrency" TEXT NOT NULL DEFAULT 'USD',
    "defaultLanguage" TEXT NOT NULL DEFAULT 'English',
    "stripeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "paypalEnabled" BOOLEAN NOT NULL DEFAULT true,
    "notifications" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

-- Settings are a singleton: pin the row to one id so a second can never exist.
ALTER TABLE "PlatformSettings" ADD CONSTRAINT "PlatformSettings_singleton"
    CHECK ("id" = 'singleton');

-- Rebrand: SkillStream -> GRS Learning.
ALTER TABLE "PlatformSettings" ALTER COLUMN "platformName" SET DEFAULT 'GRS Learning';
ALTER TABLE "PlatformSettings" ALTER COLUMN "supportEmail" SET DEFAULT 'support@grslearning.dev';

-- Only rewrite rows still holding the old defaults; admin-customised values are kept.
UPDATE "PlatformSettings" SET "platformName" = 'GRS Learning' WHERE "platformName" = 'SkillStream';
UPDATE "PlatformSettings" SET "supportEmail" = 'support@grslearning.dev' WHERE "supportEmail" = 'support@skillstream.dev';

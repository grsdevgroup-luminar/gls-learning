-- Internal storage handle for a platform-uploaded avatar. Nullable so
-- external-URL avatars (legacy rows) keep working unchanged.
ALTER TABLE "User" ADD COLUMN "avatarKey" TEXT;

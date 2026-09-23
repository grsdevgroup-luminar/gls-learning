-- Align Bangladesh with Tier 3 pricing and add the countries already declared by
-- the tier configuration but missing from the region table.
UPDATE "Region"
SET "multiplier" = 0.45, "tierId" = 't3', "override" = false
WHERE "code" = 'BD';

INSERT INTO "CountryOverride" ("country", "flag", "type", "flatPercent", "tierId")
VALUES ('Bangladesh', '🇧🇩', 'flat_percent', 45, NULL)
ON CONFLICT ("country") DO UPDATE SET
  "flag" = EXCLUDED."flag",
  "type" = EXCLUDED."type",
  "flatPercent" = EXCLUDED."flatPercent",
  "tierId" = EXCLUDED."tierId";

INSERT INTO "Region" ("code", "country", "flag", "currency", "symbol", "locale", "fxRate", "multiplier", "tierId", "override")
VALUES
  ('JP', 'Japan', '🇯🇵', 'JPY', '¥', 'ja-JP', 157, 1, 't1', false),
  ('TH', 'Thailand', '🇹🇭', 'THB', '฿', 'th-TH', 36.5, 0.7, 't2', false),
  ('PK', 'Pakistan', '🇵🇰', 'PKR', '₨', 'ur-PK', 278, 0.45, 't3', false),
  ('EG', 'Egypt', '🇪🇬', 'EGP', 'E£', 'ar-EG', 48.5, 0.45, 't3', false)
ON CONFLICT ("code") DO UPDATE SET
  "country" = EXCLUDED."country",
  "flag" = EXCLUDED."flag",
  "currency" = EXCLUDED."currency",
  "symbol" = EXCLUDED."symbol",
  "locale" = EXCLUDED."locale",
  "fxRate" = EXCLUDED."fxRate",
  "multiplier" = EXCLUDED."multiplier",
  "tierId" = EXCLUDED."tierId",
  "override" = EXCLUDED."override";
-- Adds the PARTIALLY_REFUNDED value to the OrderStatus enum. Kept in its own
-- migration because Postgres forbids running `ALTER TYPE ... ADD VALUE` inside
-- the same transaction as other DDL, so the column additions live in the
-- following migration.

ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_REFUNDED';

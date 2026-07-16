import { z } from "zod";

// Admin-facing pricing management. The Region table is the checkout source of
// truth (its `multiplier` is what pricing uses); a tier is a named multiplier
// that its assigned, non-overridden regions inherit.

// A PPP multiplier: 1 = full price, 0.5 = half. Capped at 2 to allow premium
// regions without letting a typo 10x a price.
const multiplier = z.number().min(0.01).max(2);

export const UpsertTierSchema = z.object({
  name: z.string().min(2).max(80),
  multiplier,
});
export type UpsertTierInput = z.infer<typeof UpsertTierSchema>;

export const PatchTierSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  multiplier: multiplier.optional(),
});
export type PatchTierInput = z.infer<typeof PatchTierSchema>;

export const PatchRegionSchema = z
  .object({
    tierId: z.string().min(1).optional(),
    fxRate: z.number().positive().max(100000).optional(),
    currency: z.string().min(2).max(8).optional(),
    symbol: z.string().min(1).max(6).optional(),
    // When `override` is true the region keeps its own multiplier instead of
    // inheriting the tier's. Setting a multiplier implies an override.
    override: z.boolean().optional(),
    multiplier: multiplier.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "No fields to update");
export type PatchRegionInput = z.infer<typeof PatchRegionSchema>;

export interface AdminTierDto {
  id: string;
  name: string;
  multiplier: number;
  /** Countries (region names) currently assigned to this tier. */
  countries: string[];
}

export interface AdminRegionDto {
  code: string;
  country: string;
  flag: string;
  currency: string;
  symbol: string;
  locale: string;
  fxRate: number;
  multiplier: number;
  tierId: string | null;
  override: boolean;
}

export interface AdminPricingDto {
  tiers: AdminTierDto[];
  regions: AdminRegionDto[];
}

import type { OrgStatus } from "./enums.js";

export interface OrgAccessLockInfo {
  status: OrgStatus;
  accessLocksAt: string | Date | null;
}

/**
 * Single source of truth for whether a suspended org's members currently have
 * their access locked. A SUSPENDED org with no `accessLocksAt` yet (e.g. a row
 * from before this field existed) is treated as NOT locked — the platform
 * admin must re-save the suspension to set a lock time. Migrations that
 * introduce this field must backfill `accessLocksAt` for already-suspended
 * orgs, or those orgs silently regain full access.
 */
export function isOrgAccessLocked(
  org: OrgAccessLockInfo,
  now: Date = new Date(),
): boolean {
  if (org.status !== "SUSPENDED" || !org.accessLocksAt) return false;
  return new Date(org.accessLocksAt) <= now;
}

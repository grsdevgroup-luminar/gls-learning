// Queue names live in their own module so processors/schedulers can import them
// without creating a circular dependency with jobs.module.ts.
export const MAINTENANCE_QUEUE = "maintenance";
export const NOTIFICATIONS_QUEUE = "notifications";

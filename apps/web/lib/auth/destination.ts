import type { AuthUserDto } from "@skillstream/shared";

/** Where to send a user right after they authenticate (fresh login, or
 *  finishing a forced password change). Role portals take priority over a
 *  stale/previous return path — otherwise e.g. an admin could land in
 *  /dashboard instead of /admin. */
export function destinationFor(me: AuthUserDto, next?: string | null): string {
  if (me.role === "ADMIN") return "/admin";
  // The instructor portal is internally rendered at the root path so instructors never see
  // the storefront or a visible /instructor redirect after login.
  if (me.role === "INSTRUCTOR") return "/";
  if (me.role === "DELIVERY_PARTNER") return "/delivery-partner";
  if (me.role === "ORG_ADMIN") return "/org";
  // A pending instructor/delivery-partner application means this account's
  // identity right now is "applicant," not "student" — send them to their
  // application status page instead of the student dashboard so the two
  // journeys never mix. A rejected application doesn't redirect: that user
  // is just a student again (and for delivery partner, goes through support
  // from here rather than a self-service re-apply — see
  // DELIVERY_PARTNER_MEMBER_FLOW_PLAN.md §2.4).
  if (me.instructorStatus === "PENDING") return "/instructor";
  if (me.deliveryPartnerStatus === "PENDING") return "/delivery-partner";
  return next || "/dashboard";
}

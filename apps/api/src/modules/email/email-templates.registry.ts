/**
 * The catalog of every email GRS Learning can send. Each entry's
 * `defaultSubject`/`defaultBody` is the platform's built-in copy — an admin
 * override in the `EmailTemplate` table replaces it, but this registry is
 * always the fallback, so the feature can never leave an email type broken.
 *
 * To add a new email type: add one entry here, then call
 * `EmailTemplatesService.render(key, vars)` at the trigger site. No schema
 * migration, no admin-UI change — it appears in the admin list automatically.
 */
import { credentialsBoxHtml } from "./email-layout";

export type EmailTemplateCategory =
  | "auth"
  | "organizations"
  | "delivery_partner"
  | "commerce"
  | "applications"
  | "payouts"
  | "admin_alerts";

export interface EmailTemplateVariable {
  name: string;
  description: string;
  sample: string;
}

export interface EmailTemplateDefinition {
  key: string;
  label: string;
  category: EmailTemplateCategory;
  description: string;
  defaultSubject: string;
  defaultBody: string;
  ctaLabel?: string;
  variables: EmailTemplateVariable[];
  /** For templates with structural, non-editable content (e.g.
   *  `org_admin_credentials`' account box) — sample markup so preview/test-send
   *  show it too, not just the real send. Built with the same helper
   *  (`credentialsBoxHtml`) the real send uses, just with sample values. */
  sampleProtectedHtml?: string;
}

const v = (name: string, description: string, sample: string): EmailTemplateVariable => ({
  name,
  description,
  sample,
});

/** Every email keyed by a `NotificationEvent` value (schema.prisma) shares the
 *  same shape: the call site already renders the real dynamic values
 *  (amounts, course names, …) into `title`/`body` for the in-app
 *  notification, so the template only wraps that pre-rendered copy rather
 *  than re-exposing every discrete field. Keying by the enum's own string
 *  (rather than inventing separate names) means one identifier covers both
 *  the in-app row and the email override — no translation table to keep in
 *  sync. */
const NOTIFICATION_EVENT_TEMPLATES: {
  key: string;
  label: string;
  category: EmailTemplateCategory;
  description: string;
  /** Matches what the real call site actually puts in `title`/`body` today —
   *  distinct per event so previews and test-sends actually look like the
   *  email that event sends, not a generic placeholder. */
  sampleTitle: string;
  sampleBody: string;
}[] = [
  { key: "ORDER_PAID", label: "Order paid", category: "commerce", description: "Sent when an order transitions to paid, alongside the receipt.", sampleTitle: "Payment confirmed", sampleBody: "Your order for Intro to React is paid — you're enrolled." },
  { key: "ORDER_REFUNDED", label: "Order refunded", category: "commerce", description: "Sent when an admin refunds an order (full or partial).", sampleTitle: "Order refunded", sampleBody: "USD 49.00 store credit added for: Intro to React. Reason: duplicate charge." },
  { key: "CREDIT_GRANTED", label: "Store credit granted", category: "commerce", description: "Sent when an admin manually grants store credit.", sampleTitle: "Store credit added", sampleBody: "USD 25.00 store credit was added to your account." },
  { key: "CERTIFICATE_ISSUED", label: "Certificate issued", category: "commerce", description: "Sent when a student completes a course.", sampleTitle: "Certificate issued", sampleBody: "You completed a course — your certificate is ready." },
  { key: "INSTRUCTOR_APPLICATION_APPROVED", label: "Instructor application approved", category: "applications", description: "Sent when an admin approves an instructor application.", sampleTitle: "Instructor application approved", sampleBody: "You're approved as an instructor — you can start building courses." },
  { key: "INSTRUCTOR_APPLICATION_REJECTED", label: "Instructor application rejected", category: "applications", description: "Sent when an admin rejects an instructor application.", sampleTitle: "Instructor application update", sampleBody: "Thanks for applying — we're not able to approve your application at this time." },
  { key: "DELIVERY_PARTNER_APPLICATION_APPROVED", label: "Delivery partner application approved", category: "applications", description: "Sent when an admin approves a delivery partner application.", sampleTitle: "Delivery partner application approved", sampleBody: "You're approved as a delivery partner — your referral code is ready." },
  { key: "DELIVERY_PARTNER_APPLICATION_REJECTED", label: "Delivery partner application rejected", category: "applications", description: "Sent when an admin rejects a delivery partner application.", sampleTitle: "Delivery partner application update", sampleBody: "Your delivery partner application was not approved this time." },
  { key: "PAYOUT_REQUESTED", label: "Payout requested", category: "payouts", description: "Sent when an instructor/delivery partner requests a payout.", sampleTitle: "Payout requested", sampleBody: "Your $250.00 payout is pending admin review." },
  { key: "PAYOUT_APPROVED", label: "Payout approved", category: "payouts", description: "Sent when an admin approves a payout request.", sampleTitle: "Payout approved", sampleBody: "Your $250.00 payout was approved and is being processed." },
  { key: "PAYOUT_PAID", label: "Payout paid", category: "payouts", description: "Sent when a payout is marked paid or a Stripe transfer completes.", sampleTitle: "Payout sent", sampleBody: "Your $250.00 payout was sent to your Stripe account." },
  { key: "PAYOUT_REJECTED", label: "Payout rejected", category: "payouts", description: "Sent when an admin rejects a payout request.", sampleTitle: "Payout rejected", sampleBody: "Your $250.00 payout request was rejected: bank details could not be verified." },
  { key: "REFERRAL_CONFIRMED", label: "Referral confirmed", category: "payouts", description: "Sent to a delivery partner when their referral converts.", sampleTitle: "Referral confirmed", sampleBody: "A referral you sent just converted — $15.00 commission pending." },
  { key: "COURSE_DELETED_BY_ADMIN", label: "Course deleted by admin", category: "commerce", description: "Sent to the instructor when an admin deletes a course they own.", sampleTitle: "Course deleted by admin", sampleBody: "An admin deleted your course \"Intro to React\" — reason: Violates content guidelines." },
  { key: "ORG_MEMBER_REMOVED", label: "Removed from organization", category: "organizations", description: "Sent to a member when an org admin removes them.", sampleTitle: "Removed from organization", sampleBody: "You were removed from TechCorp Inc. — reason: No longer with the company." },
  { key: "ORG_SEATS_LOW", label: "Organization seats low or full", category: "organizations", description: "Sent to org admins when a join crosses the 80% or 100% seat threshold.", sampleTitle: "Seats running low", sampleBody: "TechCorp Inc. is nearing its seat limit (16/20 used)." },
  { key: "NAME_CHANGE_REJECTED", label: "Name change request rejected", category: "applications", description: "Sent to an instructor when an admin rejects their display-name change request.", sampleTitle: "Name change request update", sampleBody: "Your requested name doesn't match your verified identity documents." },
  { key: "EMAIL_DELIVERY_FAILED", label: "Email delivery failed", category: "admin_alerts", description: "Sent to admins when a transactional email exhausts every retry.", sampleTitle: "An email failed to send", sampleBody: "The \"password_reset\" email to jane@example.com could not be delivered after 3 attempts. Check the email provider configuration." },
  { key: "TABLE_SIZE_WARNING", label: "Notification table size warning", category: "admin_alerts", description: "Sent to admins when the Notification table crosses the size threshold that signals it's time to plan partitioning.", sampleTitle: "Notification table is getting large", sampleBody: "The Notification table has reached 5,000,000 rows — time to plan the partitioning conversion." },
  { key: "INSTRUCTOR_APPLICATION_SUBMITTED", label: "New instructor application", category: "admin_alerts", description: "Sent to admins when a new instructor application is submitted.", sampleTitle: "New instructor application", sampleBody: "Priya Nair applied to become an instructor." },
  { key: "DELIVERY_PARTNER_APPLICATION_SUBMITTED", label: "New delivery partner application", category: "admin_alerts", description: "Sent to admins when a new delivery partner application is submitted.", sampleTitle: "New delivery partner application", sampleBody: "Priya Nair applied to become a delivery partner." },
  { key: "COURSE_DELETION_REQUESTED", label: "Course deletion requested", category: "admin_alerts", description: "Sent to admins when an instructor requests deletion of a course they own.", sampleTitle: "Course deletion requested", sampleBody: "An instructor requested deletion of \"Intro to React\" — reason: Content is outdated." },
  { key: "COURSE_DELETION_REQUEST_APPROVED", label: "Course deletion request approved", category: "commerce", description: "Sent to the instructor when an admin approves their course-deletion request.", sampleTitle: "Course deletion approved", sampleBody: "Your request to delete \"Intro to React\" was approved — the course has been removed." },
  { key: "COURSE_DELETION_REQUEST_REJECTED", label: "Course deletion request rejected", category: "commerce", description: "Sent to the instructor when an admin rejects their course-deletion request.", sampleTitle: "Course deletion rejected", sampleBody: "Your request to delete \"Intro to React\" was rejected — reason: Course has active enrollments." },
];

function notificationEventTemplates(): Record<string, EmailTemplateDefinition> {
  return Object.fromEntries(
    NOTIFICATION_EVENT_TEMPLATES.map(({ key, label, category, description, sampleTitle, sampleBody }) => [
      key,
      {
        key,
        label,
        category,
        description,
        defaultSubject: "{{title}}",
        defaultBody: "Hi {{first_name}}, {{body}}",
        ctaLabel: "View details",
        variables: [
          v("first_name", "The recipient's first name", "Priya"),
          v("title", "The event's headline", sampleTitle),
          v("body", "The event's detail line", sampleBody),
        ],
      } satisfies EmailTemplateDefinition,
    ]),
  );
}

export const EMAIL_TEMPLATES: Record<string, EmailTemplateDefinition> = {
  welcome: {
    key: "welcome",
    label: "Welcome email",
    category: "auth",
    description: "Sent right after a student signs up.",
    defaultSubject: "Welcome to GRS Learning 🎉",
    defaultBody:
      "You're now part of the GRS Learning community. Explore thousands of courses and start growing your skills today.",
    ctaLabel: "Browse courses",
    variables: [v("first_name", "The new student's first name", "Priya")],
  },
  password_reset: {
    key: "password_reset",
    label: "Password reset",
    category: "auth",
    description: "Sent when a user requests a password reset link.",
    defaultSubject: "Reset your GRS Learning password",
    defaultBody:
      "Hi {{first_name}}, we received a request to reset your password. Click the button below to choose a new one. This link expires in 1 hour — if you didn't request this, you can safely ignore this email.",
    ctaLabel: "Reset password",
    variables: [
      v("first_name", "The account holder's first name", "Priya"),
      v("reset_link", "The one-time password-reset link", "https://grslearning.dev/reset-password?token=…"),
    ],
  },
  org_invite: {
    key: "org_invite",
    label: "Organization invite",
    category: "organizations",
    description: "Sent when an org admin invites someone to join their team.",
    defaultSubject: "You've been invited to {{org_name}} on GRS Learning",
    defaultBody:
      "Your organization has invited you to join their team on GRS Learning as {{role_label}}. Accept to get access to your company's courses. This invitation expires in 7 days.",
    ctaLabel: "Accept invitation",
    variables: [
      v("org_name", "The inviting organization's name", "Acme Corp"),
      v("role_label", "\"an admin\" or \"a member\"", "a member"),
      v("invite_link", "The one-time invitation link", "https://grslearning.dev/join/…"),
    ],
  },
  partner_application_submitted: {
    key: "partner_application_submitted",
    label: "Delivery partner application submitted",
    category: "delivery_partner",
    description: "Sent right after a visitor submits a delivery partner application, in place of the generic welcome email.",
    defaultSubject: "We've received your delivery partner application",
    defaultBody:
      "Hi {{first_name}}, thanks for applying to become a GRS Learning delivery partner. We'll review your application and get back to you within 1–2 business days — you'll receive an email as soon as a decision is made.",
    ctaLabel: "View application status",
    variables: [v("first_name", "The applicant's first name", "Priya")],
  },
  partner_member_invite: {
    key: "partner_member_invite",
    label: "Delivery partner member invite",
    category: "delivery_partner",
    description: "Sent when a delivery partner invites someone to access one of their assigned courses.",
    defaultSubject: "You've been invited to {{course_title}} on GRS Learning",
    defaultBody:
      "{{partner_name}} has invited you to access {{course_title}} on GRS Learning, free of charge. Accept to start learning. This invitation expires in 7 days.",
    ctaLabel: "Accept invitation",
    variables: [
      v("partner_name", "The inviting delivery partner's name", "James Whitfield"),
      v("course_title", "The course this invite grants access to", "React 18 Mastery"),
      v("invite_link", "The one-time invitation link", "https://grslearning.dev/join/…"),
    ],
  },
  org_admin_credentials: {
    key: "org_admin_credentials",
    label: "Organization admin credentials",
    category: "organizations",
    description: "Sent when a platform admin creates a new organization.",
    defaultSubject: "Your {{org_name}} organization is ready on GRS Learning",
    defaultBody:
      "Hi {{admin_name}}, your organization has been set up on GRS Learning. Sign in with the credentials below — you'll be asked to choose your own password right away.",
    ctaLabel: "Sign in",
    variables: [
      v("admin_name", "The new org admin's name", "Priya"),
      v("org_name", "The organization's name", "Acme Corp"),
      v("admin_email", "The org admin's login email", "admin@acme.com"),
      v("temp_password", "The generated temporary password", "Xk3f-9Qz1"),
      v("login_link", "The sign-in page link", "https://grslearning.dev/login"),
    ],
    sampleProtectedHtml: credentialsBoxHtml("admin@acme.com", "Xk3f-9Qz1"),
  },
  receipt: {
    key: "receipt",
    label: "Purchase receipt",
    category: "commerce",
    description: "Sent when an order is marked paid, PDF receipt attached.",
    defaultSubject: "Your GRS Learning receipt — {{total}}",
    defaultBody:
      "Thanks for your purchase, {{first_name}}. Order {{order_id}}: {{items}}. Total paid: {{total}}. Your receipt is attached, and your courses are ready in your dashboard.",
    variables: [
      v("first_name", "The buyer's first name", "Priya"),
      v("order_id", "The order id", "ord_123"),
      v("items", "Comma-separated course titles", "Intro to React, Advanced CSS"),
      v("total", "Formatted order total", "USD 49.00"),
    ],
  },
  ...notificationEventTemplates(),
  admin_alert_new_enrollment: {
    key: "admin_alert_new_enrollment",
    label: "Admin alert — new enrollment",
    category: "admin_alerts",
    description: "Sent to opted-in admins when a student enrolls (if the toggle is on).",
    defaultSubject: "New enrollment: {{course_title}}",
    defaultBody: "{{learner_name}} enrolled in \"{{course_title}}\".",
    variables: [
      v("learner_name", "The enrolling student's name", "Priya"),
      v("course_title", "The course title", "Intro to React"),
    ],
  },
  admin_alert_new_review: {
    key: "admin_alert_new_review",
    label: "Admin alert — new review",
    category: "admin_alerts",
    description: "Sent to opted-in admins when a course review is submitted (if the toggle is on).",
    defaultSubject: "New {{rating}}★ review: {{course_title}}",
    defaultBody:
      "{{author_name}} left a {{rating}}-star review on \"{{course_title}}\". It stays hidden from the storefront until you approve it in Admin → Reviews.",
    variables: [
      v("author_name", "The reviewer's name", "Priya"),
      v("rating", "Star rating, 1-5", "5"),
      v("course_title", "The course title", "Intro to React"),
    ],
  },
  admin_alert_daily_revenue: {
    key: "admin_alert_daily_revenue",
    label: "Admin alert — daily revenue summary",
    category: "admin_alerts",
    description: "Sent to opted-in admins once a day (if the toggle is on).",
    defaultSubject: "Daily summary — {{revenue}} from {{order_count}} orders",
    defaultBody:
      "Date: {{date}}. Revenue: {{revenue}} across {{order_count}} paid order(s). New enrollments: {{enrollments}}. New signups: {{signups}}.",
    variables: [
      v("date", "The summarized date (UTC)", "2026-09-09"),
      v("revenue", "Formatted gross revenue", "$412.00"),
      v("order_count", "Number of paid orders", "9"),
      v("enrollments", "New enrollments that day", "12"),
      v("signups", "New signups that day", "4"),
    ],
  },
  admin_alert_at_risk_digest: {
    key: "admin_alert_at_risk_digest",
    label: "Admin alert — at-risk student digest",
    category: "admin_alerts",
    description: "Sent to opted-in admins when learners are flagged at-risk (if the toggle is on).",
    defaultSubject: "{{student_count}} student(s) at risk",
    defaultBody: "These learners have stalled and may need a nudge: {{student_list}}",
    variables: [
      v("student_count", "Number of at-risk students", "3"),
      v("student_list", "Bullet lines of name (email)", "• Priya (priya@example.com)"),
    ],
  },
};

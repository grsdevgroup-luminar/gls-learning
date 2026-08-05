// ---------------------------------------------------------------------------
// Seed-fixture-only types. This is what used to be apps/web/types/index.ts,
// before the frontend was migrated onto @skillstream/shared DTOs directly and
// this file (+ apps/web/lib/mock/*) was deleted as dead frontend code. It
// wasn't dead here: prisma/seed.ts's fixture data (courses.ts, instructors.ts,
// etc., now living alongside this file in prisma/seed-data/) is still typed
// against this shape. Restored here, backend-owned, so the seed script no
// longer reaches into apps/web at all. Only used by files in this directory —
// do not import from apps/web against this file existing again.
// ---------------------------------------------------------------------------

export type Level = 'Beginner' | 'Intermediate' | 'Advanced' | 'All Levels';

export type CourseStatus = 'published' | 'draft' | 'review';

export type InstructorStatus = 'pending' | 'approved' | 'rejected';

export interface Instructor {
  id: string;
  name: string;
  title: string;
  avatar: string;
  bio: string;
  rating: number;
  students: number;
  courses: number;
  email?: string;
  expertise?: string;
  status?: InstructorStatus; // omitted = approved (legacy seed data)
}

export interface InstructorApplication {
  id: string; // also used as the future instructorId
  name: string;
  email: string;
  expertise: string; // primary category / field
  headline: string; // professional title
  bio: string;
  sampleUrl?: string; // link to a teaching sample / portfolio
  appliedAt: string; // ISO
  status: InstructorStatus;
  reviewedAt?: string; // ISO
  note?: string; // admin note on decision
}

export interface QuizOption {
  id: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: QuizOption[];
  correctOptionId: string;
  explanation?: string;
}

export interface Quiz {
  passScore: number; // percent (0-100) required to pass
  questions: QuizQuestion[];
}

export interface Lesson {
  id: string;
  title: string;
  durationSec: number;
  type: 'video' | 'quiz' | 'article';
  preview?: boolean; // free preview on the storefront
  resources?: { name: string; url: string; sizeLabel?: string }[];
  quiz?: Quiz;
}

export interface Section {
  id: string;
  title: string;
  lessons: Lesson[];
}

export interface Review {
  id: string;
  courseId: string;
  author: string;
  avatar: string;
  rating: number;
  date: string; // ISO
  title: string;
  body: string;
  status: 'approved' | 'pending' | 'hidden';
  helpful: number;
}

export interface Course {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  category: string;
  level: Level;
  thumbnail: string; // gradient seed / color key
  instructorId: string;
  /** Instructor as returned by the API alongside the course. Prefer this over
   *  looking `instructorId` up in the mock list — that only resolves for seeded
   *  ids and renders blank for any course created through the app. The stats are
   *  optional because the catalog summary omits them; only the detail DTO has them. */
  instructor?: {
    id: string;
    name: string;
    title: string;
    avatar: string | null;
    bio?: string;
    rating?: number;
    students?: number;
    courses?: number;
  };
  basePrice: number; // USD
  originalPrice?: number; // for "sale" display
  rating: number;
  reviewCount: number;
  studentCount: number;
  language: string;
  updatedAt: string; // ISO
  status: CourseStatus;
  bestseller?: boolean;
  whatYouLearn: string[];
  requirements: string[];
  sections: Section[];
  // Totals the API reports directly. Summaries carry no `sections`, so the
  // curriculum can't be counted client-side — prefer these when present.
  lessonCount?: number;
  durationSec?: number;
  revenue: number; // admin metric
  visibility?: 'public' | 'private'; // private = org-only, unlisted from storefront
  orgId?: string; // owning org when visibility === 'private'
}

export type ReminderTrigger =
  | 'idle'
  | 'low_progress'
  | 'abandoned_cart'
  | 'almost_done'
  | 'new_content';

export type ReminderChannel = 'email' | 'sms';

export interface NotificationPrefs {
  idle: ReminderChannel[];
  low_progress: ReminderChannel[];
  almost_done: ReminderChannel[];
  promotions: ReminderChannel[];
}

export interface EnrollmentProgress {
  courseId: string;
  completedLessonIds: string[];
  lastActivity: string; // ISO
  // minutes watched
  minutesWatched: number;
}

export interface Student {
  id: string;
  name: string;
  email: string;
  avatar: string;
  country: string;
  joinedAt: string;
  enrollments: EnrollmentProgress[];
  streakDays: number;
  status: 'active' | 'idle' | 'at_risk';
  totalSpent: number;
  prefs: NotificationPrefs;
}

export interface Coupon {
  code: string;
  type: 'percent' | 'fixed' | 'free';
  value: number; // percent (0-100) or fixed USD
  description: string;
  minSpend?: number;
  scope: 'global' | 'course';
  courseId?: string;
  expiresAt: string; // ISO
  usageLimit: number;
  used: number;
  active: boolean;
}

export interface PricingTier {
  id: string;
  name: string;
  multiplier: number; // applied to basePrice
  countries: string[]; // ISO-ish names
}

export interface CountryOverride {
  country: string;
  flag: string;
  // either a tier or a flat percentage of base
  type: 'tier' | 'flat_percent';
  tierId?: string;
  flatPercent?: number;
}

export interface Region {
  code: string;
  country: string;
  flag: string;
  currency: string;
  symbol: string;
  rate: number; // USD -> local conversion (for display)
}

export interface Order {
  id: string;
  date: string;
  studentName: string;
  studentEmail: string;
  country: string;
  items: { courseId: string; title: string; price: number }[];
  subtotal: number;
  discount: number;
  total: number;
  coupon?: string;
  gateway: 'stripe' | 'paypal';
  status: 'paid' | 'refunded' | 'failed';
}

export interface ReminderLogEntry {
  id: string;
  date: string;
  student: string;
  channel: ReminderChannel;
  trigger: ReminderTrigger;
  subject: string;
  status: 'sent' | 'opened' | 'clicked' | 'bounced';
}

export interface AutomationRule {
  id: string;
  name: string;
  trigger: ReminderTrigger;
  condition: string;
  channels: ReminderChannel[];
  template: string;
  active: boolean;
  sentCount: number;
}

export interface CartItem {
  courseId: string;
}

// ── Sales Agents ─────────────────────────────────────────────────────────────

export type SalesAgentStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface SalesAgentApplication {
  id: string;
  name: string;
  email: string;
  phone?: string;
  region: string; // geographic region they cover
  bio: string;
  appliedAt: string; // ISO
  status: SalesAgentStatus;
  reviewedAt?: string;
  note?: string;
}

export interface SalesAgentReferral {
  id: string;
  agentId: string;
  orderId: string;
  studentName: string;
  courseTitle: string;
  orderTotal: number; // USD
  commissionEarned: number; // USD
  status: 'pending' | 'confirmed' | 'paid';
  date: string; // ISO
}

export interface SalesAgent {
  id: string;
  name: string;
  email: string;
  avatar: string;
  phone?: string;
  region: string;
  referralCode: string;
  commissionPercent: number;
  status: SalesAgentStatus;
  joinedAt: string; // ISO
  totalEarnings: number; // USD lifetime confirmed commissions
  pendingEarnings: number; // USD awaiting confirmation
  paidEarnings: number; // USD already paid out
  referralCount: number; // total referred orders
}

// ── B2B Organizations ─────────────────────────────────────────────────────────

export type OrgStatus = 'active' | 'trial' | 'suspended';

export type OrgMemberRole = 'admin' | 'member';

export interface OrgMember {
  id: string;
  orgId: string;
  name: string;
  email: string;
  avatar: string;
  role: OrgMemberRole;
  joinedAt: string; // ISO
  enrolledCourseIds: string[];
}

export interface OrgInvitation {
  id: string;
  orgId: string;
  email: string;
  role: OrgMemberRole;
  token: string;
  expiresAt: string; // ISO
  claimedAt?: string; // ISO; set when redeemed
}

export interface Organization {
  id: string;
  slug: string;
  name: string;
  domain?: string; // company email domain for auto-verification
  logoUrl?: string;
  adminEmail: string;
  status: OrgStatus;
  seatCount: number; // total purchased seats
  usedSeats: number; // seats actively occupied
  privateCourseIds: string[]; // courses assigned to this org
  members: OrgMember[];
  createdAt: string; // ISO
}

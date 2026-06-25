// ---------------------------------------------------------------------------
// Shared domain types for the SkillStream prototype
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
  resources?: { name: string; size: string }[];
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
  revenue: number; // admin metric
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

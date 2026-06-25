/**
 * Seeds the database to full parity with the prototype's mock data. For now it
 * imports the mock modules directly from apps/web (they use type-only imports,
 * erased at runtime). When the frontend is rewired off the mocks, snapshot this
 * data into the seed so it becomes self-contained.
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import * as argon2 from "argon2";

import { courses as mockCourses } from "../../web/lib/mock/courses";
import {
  instructors as mockInstructors,
  pendingApplications,
} from "../../web/lib/mock/instructors";
import { students as mockStudents } from "../../web/lib/mock/students";
import { coupons as mockCoupons } from "../../web/lib/mock/coupons";
import { reviews as mockReviews } from "../../web/lib/mock/reviews";
import { automationRules as mockRules } from "../../web/lib/mock/automation";

const prisma = new PrismaClient();

const cents = (d: number) => Math.round(d * 100);

const LEVEL: Record<string, Prisma.CourseCreateInput["level"]> = {
  Beginner: "BEGINNER",
  Intermediate: "INTERMEDIATE",
  Advanced: "ADVANCED",
  "All Levels": "ALL_LEVELS",
};
const COURSE_STATUS: Record<string, Prisma.CourseCreateInput["status"]> = {
  published: "PUBLISHED",
  draft: "DRAFT",
  review: "REVIEW",
};
const LESSON_TYPE: Record<string, "VIDEO" | "QUIZ" | "ARTICLE"> = {
  video: "VIDEO",
  quiz: "QUIZ",
  article: "ARTICLE",
};
const REVIEW_STATUS: Record<string, "PENDING" | "APPROVED" | "HIDDEN"> = {
  approved: "APPROVED",
  pending: "PENDING",
  hidden: "HIDDEN",
};
const REMINDER_TRIGGER: Record<string, any> = {
  idle: "IDLE",
  low_progress: "LOW_PROGRESS",
  abandoned_cart: "ABANDONED_CART",
  almost_done: "ALMOST_DONE",
  new_content: "NEW_CONTENT",
};

function slugifyName(name: string): string {
  return (
    "usr_" +
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
  );
}

async function main() {
  const defaultHash = await argon2.hash("password123", { type: argon2.argon2id });

  // ── Admin ──
  await prisma.user.upsert({
    where: { email: "admin@skillstream.dev" },
    update: {},
    create: {
      email: "admin@skillstream.dev",
      name: "Platform Admin",
      passwordHash: await argon2.hash("admin12345", { type: argon2.argon2id }),
      role: "ADMIN",
      emailVerified: true,
    },
  });

  // ── Pricing tiers / regions / overrides ──
  const pricingTiers = [
    { id: "t1", name: "Tier 1 — High income", multiplier: 1, countries: ["United States", "United Kingdom", "Germany", "Canada", "Australia", "Japan"] },
    { id: "t2", name: "Tier 2 — Middle income", multiplier: 0.7, countries: ["Brazil", "Mexico", "Turkey", "Thailand", "South Africa"] },
    { id: "t3", name: "Tier 3 — Emerging", multiplier: 0.45, countries: ["India", "Bangladesh", "Nigeria", "Pakistan", "Egypt"] },
  ];
  const regions = [
    { code: "US", country: "United States", flag: "🇺🇸", currency: "USD", symbol: "$", locale: "en-US", fxRate: 1, multiplier: 1, tierId: "t1" },
    { code: "GB", country: "United Kingdom", flag: "🇬🇧", currency: "GBP", symbol: "£", locale: "en-GB", fxRate: 0.79, multiplier: 1, tierId: "t1" },
    { code: "DE", country: "Germany", flag: "🇩🇪", currency: "EUR", symbol: "€", locale: "de-DE", fxRate: 0.92, multiplier: 1, tierId: "t1" },
    { code: "CA", country: "Canada", flag: "🇨🇦", currency: "CAD", symbol: "C$", locale: "en-CA", fxRate: 1.37, multiplier: 1, tierId: "t1" },
    { code: "AU", country: "Australia", flag: "🇦🇺", currency: "AUD", symbol: "A$", locale: "en-AU", fxRate: 1.51, multiplier: 1, tierId: "t1" },
    { code: "BR", country: "Brazil", flag: "🇧🇷", currency: "BRL", symbol: "R$", locale: "pt-BR", fxRate: 5.42, multiplier: 0.7, tierId: "t2" },
    { code: "MX", country: "Mexico", flag: "🇲🇽", currency: "MXN", symbol: "MX$", locale: "es-MX", fxRate: 17.1, multiplier: 0.7, tierId: "t2" },
    { code: "TR", country: "Turkey", flag: "🇹🇷", currency: "TRY", symbol: "₺", locale: "tr-TR", fxRate: 32.5, multiplier: 0.7, tierId: "t2" },
    { code: "ZA", country: "South Africa", flag: "🇿🇦", currency: "ZAR", symbol: "R", locale: "en-ZA", fxRate: 18.4, multiplier: 0.7, tierId: "t2" },
    { code: "IN", country: "India", flag: "🇮🇳", currency: "INR", symbol: "₹", locale: "en-IN", fxRate: 83.2, multiplier: 0.35, tierId: "t3", override: true },
    { code: "BD", country: "Bangladesh", flag: "🇧🇩", currency: "BDT", symbol: "৳", locale: "bn-BD", fxRate: 117, multiplier: 0.3, tierId: "t3", override: true },
    { code: "NG", country: "Nigeria", flag: "🇳🇬", currency: "NGN", symbol: "₦", locale: "en-NG", fxRate: 1480, multiplier: 0.45, tierId: "t3" },
  ];
  const countryOverrides = [
    { country: "Bangladesh", flag: "🇧🇩", type: "flat_percent", flatPercent: 30 },
    { country: "India", flag: "🇮🇳", type: "flat_percent", flatPercent: 35 },
  ];
  for (const t of pricingTiers)
    await prisma.pricingTier.upsert({ where: { id: t.id }, update: t, create: t });
  for (const r of regions)
    await prisma.region.upsert({ where: { code: r.code }, update: r, create: r });
  for (const o of countryOverrides)
    await prisma.countryOverride.upsert({ where: { country: o.country }, update: o, create: o });

  // ── Instructors → User + InstructorProfile ──
  for (const ins of mockInstructors) {
    await prisma.user.upsert({
      where: { id: ins.id },
      update: {},
      create: {
        id: ins.id,
        email: ins.email ?? `${ins.id}@skillstream.com`,
        name: ins.name,
        passwordHash: defaultHash,
        role: "INSTRUCTOR",
        emailVerified: true,
        instructorProfile: {
          create: {
            title: ins.title,
            bio: ins.bio,
            expertise: ins.expertise,
            ratingAvg: ins.rating,
            studentCount: ins.students,
            courseCount: ins.courses,
            status: "APPROVED",
          },
        },
      },
    });
  }

  // ── Pending instructor applications ──
  for (const app of pendingApplications) {
    await prisma.instructorApplication.upsert({
      where: { id: app.id },
      update: {},
      create: {
        id: app.id,
        name: app.name,
        email: app.email,
        expertise: app.expertise,
        headline: app.headline,
        bio: app.bio,
        sampleUrl: app.sampleUrl,
        status: "PENDING",
        appliedAt: new Date(app.appliedAt),
      },
    });
  }

  // ── Courses (+ sections, lessons, quizzes) ──
  for (const c of mockCourses) {
    await prisma.course.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id,
        slug: c.slug,
        title: c.title,
        subtitle: c.subtitle,
        description: c.description,
        category: c.category,
        level: LEVEL[c.level],
        thumbnail: c.thumbnail,
        instructorId: c.instructorId,
        basePriceCents: cents(c.basePrice),
        originalPriceCents: c.originalPrice ? cents(c.originalPrice) : null,
        language: c.language,
        status: COURSE_STATUS[c.status],
        bestseller: c.bestseller ?? false,
        whatYouLearn: c.whatYouLearn,
        requirements: c.requirements,
        ratingAvg: c.rating,
        reviewCount: c.reviewCount,
        studentCount: c.studentCount,
        revenueCents: cents(c.revenue),
        updatedAt: new Date(c.updatedAt),
        publishedAt: c.status === "published" ? new Date(c.updatedAt) : null,
        sections: {
          create: c.sections.map((s, si) => ({
            id: `${c.id}_${s.id}`,
            title: s.title,
            order: si,
            lessons: {
              create: s.lessons.map((l, li) => ({
                id: l.id,
                title: l.title,
                durationSec: l.durationSec,
                type: LESSON_TYPE[l.type],
                preview: l.preview ?? false,
                order: li,
                resources: (l.resources ?? []) as unknown as Prisma.InputJsonValue,
                quiz: l.quiz
                  ? {
                      create: {
                        id: `quiz_${l.id}`,
                        passScore: l.quiz.passScore,
                        questions: {
                          create: l.quiz.questions.map((q, qi) => ({
                            id: q.id,
                            prompt: q.prompt,
                            explanation: q.explanation,
                            order: qi,
                            options: {
                              create: q.options.map((o, oi) => ({
                                id: o.id,
                                text: o.text,
                                isCorrect: o.id === q.correctOptionId,
                                order: oi,
                              })),
                            },
                          })),
                        },
                      },
                    }
                  : undefined,
              })),
            },
          })),
        },
      },
    });
  }

  // ── Students → User + StudentProfile + Enrollments + LessonProgress ──
  for (const s of mockStudents) {
    const isDemo = s.email === "student@demo.com";
    await prisma.user.upsert({
      where: { id: s.id },
      update: {},
      create: {
        id: s.id,
        email: s.email,
        name: s.name,
        country: s.country,
        passwordHash: isDemo
          ? await argon2.hash("student12345", { type: argon2.argon2id })
          : defaultHash,
        role: "STUDENT",
        emailVerified: true,
        createdAt: new Date(s.joinedAt),
        studentProfile: {
          create: {
            streakDays: s.streakDays,
            status: s.status.toUpperCase() as any,
            totalSpentCents: cents(s.totalSpent),
            notificationPrefs: s.prefs as unknown as Prisma.InputJsonValue,
          },
        },
      },
    });

    for (const e of s.enrollments) {
      const enrollment = await prisma.enrollment.upsert({
        where: { userId_courseId: { userId: s.id, courseId: e.courseId } },
        update: {},
        create: {
          userId: s.id,
          courseId: e.courseId,
          minutesWatched: e.minutesWatched,
          lastActivityAt: new Date(e.lastActivity),
          enrolledAt: new Date(e.lastActivity),
        },
      });
      for (const lessonId of e.completedLessonIds) {
        await prisma.lessonProgress.upsert({
          where: {
            enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId },
          },
          update: {},
          create: { enrollmentId: enrollment.id, lessonId, completed: true },
        });
      }
    }
  }

  // ── Reviews → reviewer User pool (one review per (course,user)) ──
  const seenCourseUser = new Set<string>();
  for (const r of mockReviews) {
    const userId = slugifyName(r.author);
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: `${userId}@reviewers.skillstream.dev`,
        name: r.author,
        passwordHash: defaultHash,
        role: "STUDENT",
        emailVerified: true,
      },
    });
    const key = `${r.courseId}:${userId}`;
    if (seenCourseUser.has(key)) continue; // unique(courseId,userId)
    seenCourseUser.add(key);
    await prisma.review.upsert({
      where: { courseId_userId: { courseId: r.courseId, userId } },
      update: {},
      create: {
        courseId: r.courseId,
        userId,
        rating: r.rating,
        title: r.title,
        body: r.body,
        status: REVIEW_STATUS[r.status],
        helpful: r.helpful,
        createdAt: new Date(r.date),
      },
    });
  }

  // ── Coupons ──
  for (const c of mockCoupons) {
    await prisma.coupon.upsert({
      where: { code: c.code },
      update: {},
      create: {
        code: c.code,
        type: c.type.toUpperCase() as any,
        // PERCENT keeps the percent value; FIXED stored as cents; FREE ignores it.
        value: c.type === "fixed" ? cents(c.value) : c.value,
        description: c.description,
        minSpendCents: c.minSpend ? cents(c.minSpend) : null,
        scope: c.scope.toUpperCase() as any,
        courseId: c.courseId,
        expiresAt: new Date(c.expiresAt),
        usageLimit: c.usageLimit,
        used: c.used,
        active: c.active,
      },
    });
  }

  // ── Automation rules ──
  for (const r of mockRules) {
    await prisma.automationRule.upsert({
      where: { id: r.id },
      update: {},
      create: {
        id: r.id,
        name: r.name,
        trigger: REMINDER_TRIGGER[r.trigger],
        condition: r.condition,
        channels: r.channels.map((ch) => ch.toUpperCase()) as any,
        template: r.template,
        active: r.active,
        sentCount: r.sentCount,
      },
    });
  }

  const counts = {
    users: await prisma.user.count(),
    courses: await prisma.course.count(),
    lessons: await prisma.lesson.count(),
    reviews: await prisma.review.count(),
    coupons: await prisma.coupon.count(),
    enrollments: await prisma.enrollment.count(),
  };
  console.log("Seed complete:", counts);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

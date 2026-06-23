import type { Student, EnrollmentProgress, NotificationPrefs } from "@/types";
import { getCourseById } from "./courses";

// Build a realistic completedLessonIds list from a target completion %.
function enroll(
  courseId: string,
  pct: number,
  daysAgo: number,
  minutes: number,
): EnrollmentProgress {
  const course = getCourseById(courseId);
  const allLessons = course ? course.sections.flatMap((s) => s.lessons) : [];
  const n = Math.round((pct / 100) * allLessons.length);
  const d = new Date("2026-06-23");
  d.setDate(d.getDate() - daysAgo);
  return {
    courseId,
    completedLessonIds: allLessons.slice(0, n).map((l) => l.id),
    lastActivity: d.toISOString().slice(0, 10),
    minutesWatched: minutes,
  };
}

const defaultPrefs: NotificationPrefs = {
  idle: ["email", "sms"],
  low_progress: ["email"],
  almost_done: ["email"],
  promotions: ["email"],
};

export const DEMO_STUDENT_ID = "stu_alex";

export const students: Student[] = [
  {
    id: "stu_alex",
    name: "Alex Morgan",
    email: "student@demo.com",
    avatar: "",
    country: "United States",
    joinedAt: "2026-02-14",
    streakDays: 6,
    status: "active",
    totalSpent: 234.97,
    prefs: defaultPrefs,
    enrollments: [
      enroll("c_react", 45, 1, 312),
      enroll("c_design", 80, 2, 410),
      enroll("c_python", 100, 12, 198),
    ],
  },
  {
    id: "stu_2",
    name: "Bianca Rossi",
    email: "bianca@example.com",
    avatar: "",
    country: "Brazil",
    joinedAt: "2026-03-01",
    streakDays: 0,
    status: "at_risk",
    totalSpent: 62.99,
    prefs: defaultPrefs,
    enrollments: [enroll("c_ml", 12, 21, 64)],
  },
  {
    id: "stu_3",
    name: "Rahul Verma",
    email: "rahul@example.com",
    avatar: "",
    country: "India",
    joinedAt: "2026-01-19",
    streakDays: 14,
    status: "active",
    totalSpent: 48.99,
    prefs: defaultPrefs,
    enrollments: [enroll("c_python", 92, 0, 240), enroll("c_react", 30, 0, 120)],
  },
  {
    id: "stu_4",
    name: "Emma Schmidt",
    email: "emma@example.com",
    avatar: "",
    country: "Germany",
    joinedAt: "2026-04-22",
    streakDays: 0,
    status: "idle",
    totalSpent: 84.99,
    prefs: defaultPrefs,
    enrollments: [enroll("c_aws", 22, 9, 88)],
  },
  {
    id: "stu_5",
    name: "Kwame Mensah",
    email: "kwame@example.com",
    avatar: "",
    country: "Nigeria",
    joinedAt: "2026-05-30",
    streakDays: 3,
    status: "active",
    totalSpent: 26.99,
    prefs: defaultPrefs,
    enrollments: [enroll("c_growth", 55, 1, 142)],
  },
  {
    id: "stu_6",
    name: "Yuki Tanaka",
    email: "yuki@example.com",
    avatar: "",
    country: "Japan",
    joinedAt: "2026-02-28",
    streakDays: 0,
    status: "at_risk",
    totalSpent: 164.98,
    prefs: defaultPrefs,
    enrollments: [enroll("c_ts", 8, 26, 41), enroll("c_design", 5, 26, 22)],
  },
];

export function getStudent(id: string) {
  return students.find((s) => s.id === id);
}
export const demoStudent = students[0];

export function progressPct(e: EnrollmentProgress): number {
  const course = getCourseById(e.courseId);
  if (!course) return 0;
  const total = course.sections.reduce((a, s) => a + s.lessons.length, 0);
  return total ? Math.round((e.completedLessonIds.length / total) * 100) : 0;
}

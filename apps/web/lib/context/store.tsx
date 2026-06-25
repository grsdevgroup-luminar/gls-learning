'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { demoStudent, DEMO_STUDENT_ID } from '@/lib/mock/students';
import { DEFAULT_REGION, getRegion } from '@/lib/mock/pricing';
import { courses as baseCourses } from '@/lib/mock/courses';
import {
  getInstructor as getMockInstructor,
  pendingApplications,
} from '@/lib/mock/instructors';
import type {
  Course,
  CourseStatus,
  Instructor,
  InstructorApplication,
  InstructorStatus,
} from '@/types';

export type Role = 'guest' | 'student' | 'instructor' | 'admin';

/** Default instructor identity for the "Log in as instructor" demo shortcut. */
export const DEMO_INSTRUCTOR_ID = 'ins_sara';

export interface QuizResult {
  bestScore: number; // percent, best attempt
  lastScore: number; // percent, most recent attempt
  attempts: number;
  passed: boolean;
  lastAttemptAt: string; // ISO
}

export interface MyReview {
  rating: number;
  title: string;
  body: string;
  date: string; // ISO
}

interface PersistState {
  role: Role;
  regionCode: string;
  cart: string[];
  coupon: string | null;
  enrolled: string[];
  progress: Record<string, string[]>;
  quizResults: Record<string, QuizResult>; // key: `${courseId}:${lessonId}`
  myReviews: Record<string, MyReview>; // key: courseId
  customCourses: Record<string, Course>; // admin-created/edited courses, keyed by id
  deletedCourseIds: string[];
  // instructor program
  currentInstructorId: string | null; // who the logged-in instructor is
  instructorApplications: InstructorApplication[]; // approval queue
  customInstructors: Record<string, Instructor>; // approved-from-application profiles
}

const STORAGE_KEY = 'SkillStream_state_v1';

function quizKey(courseId: string, lessonId: string) {
  return `${courseId}:${lessonId}`;
}

/** Resolve an instructor from custom (approved-from-application) → seed mock →
 *  a still-pending application (so a freshly-applied user has a profile). */
function resolveInstructor(
  state: PersistState,
  id: string | null,
): Instructor | null {
  if (!id) return null;
  const custom = state.customInstructors[id];
  if (custom) return custom;
  const seed = getMockInstructor(id);
  if (seed) return seed;
  const app = state.instructorApplications.find((a) => a.id === id);
  if (app) {
    return {
      id: app.id,
      name: app.name,
      title: app.headline,
      avatar: '',
      bio: app.bio,
      rating: 0,
      students: 0,
      courses: 0,
      email: app.email,
      expertise: app.expertise,
      status: app.status,
    };
  }
  return null;
}

function instructorStatusOf(
  state: PersistState,
  id: string,
): InstructorStatus | undefined {
  const custom = state.customInstructors[id];
  if (custom) return custom.status ?? 'approved';
  if (getMockInstructor(id)) return 'approved';
  return state.instructorApplications.find((a) => a.id === id)?.status;
}

function seedProgress(): Record<string, string[]> {
  const p: Record<string, string[]> = {};
  demoStudent.enrollments.forEach((e) => {
    p[e.courseId] = [...e.completedLessonIds];
  });
  return p;
}

function defaultState(): PersistState {
  return {
    role: 'guest',
    regionCode: DEFAULT_REGION,
    cart: [],
    coupon: null,
    enrolled: demoStudent.enrollments.map((e) => e.courseId),
    progress: seedProgress(),
    quizResults: {},
    myReviews: {},
    customCourses: {},
    deletedCourseIds: [],
    currentInstructorId: null,
    instructorApplications: pendingApplications.map((a) => ({ ...a })),
    customInstructors: {},
  };
}

interface StoreContextValue extends PersistState {
  mounted: boolean;
  // auth
  login: (asAdmin?: boolean) => void;
  loginAs: (role: Role) => void;
  logout: () => void;
  // region
  setRegionCode: (code: string) => void;
  region: ReturnType<typeof getRegion>;
  // cart
  addToCart: (courseId: string) => void;
  removeFromCart: (courseId: string) => void;
  clearCart: () => void;
  inCart: (courseId: string) => boolean;
  setCoupon: (code: string | null) => void;
  // enrollment + progress
  isEnrolled: (courseId: string) => boolean;
  enroll: (courseIds: string[]) => void;
  toggleLesson: (courseId: string, lessonId: string) => void;
  isLessonDone: (courseId: string, lessonId: string) => boolean;
  completedCount: (courseId: string) => number;
  // quizzes
  getQuizResult: (courseId: string, lessonId: string) => QuizResult | undefined;
  submitQuizAttempt: (
    courseId: string,
    lessonId: string,
    scorePercent: number,
    passScore: number,
  ) => QuizResult;
  // reviews
  getMyReview: (courseId: string) => MyReview | undefined;
  submitReview: (
    courseId: string,
    rating: number,
    title: string,
    body: string,
  ) => void;
  // course management
  courses: Course[];
  getCourse: (id: string) => Course | undefined;
  upsertCourse: (course: Course) => void;
  deleteCourse: (id: string) => void;
  setCourseStatus: (id: string, status: CourseStatus) => void;
  reset: () => void;
  // instructor program
  currentInstructor: Instructor | null;
  getInstructorById: (id: string) => Instructor | undefined;
  instructorStatusOf: (id: string) => InstructorStatus | undefined;
  myCourses: Course[];
  loginAsInstructor: (instructorId?: string) => void;
  applyAsInstructor: (data: {
    name: string;
    email: string;
    expertise: string;
    headline: string;
    bio: string;
    sampleUrl?: string;
  }) => string;
  approveInstructor: (applicationId: string, note?: string) => void;
  rejectInstructor: (applicationId: string, note?: string) => void;
  updateInstructorProfile: (partial: Partial<Instructor>) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistState>(defaultState);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState({ ...defaultState(), ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, mounted]);

  const patch = useCallback((p: Partial<PersistState>) => {
    setState((s) => ({ ...s, ...p }));
  }, []);

  const courses = useMemo(() => {
    const known = baseCourses
      .filter((c) => !state.deletedCourseIds.includes(c.id))
      .map((c) => state.customCourses[c.id] ?? c);
    const created = Object.values(state.customCourses).filter(
      (c) =>
        !baseCourses.some((b) => b.id === c.id) &&
        !state.deletedCourseIds.includes(c.id),
    );
    return [...created, ...known];
  }, [state.customCourses, state.deletedCourseIds]);

  const value: StoreContextValue = {
    ...state,
    mounted,
    region: getRegion(state.regionCode),
    login: (asAdmin) => patch({ role: asAdmin ? 'admin' : 'student' }),
    loginAs: (role) => patch({ role }),
    logout: () => patch({ role: 'guest' }),
    setRegionCode: (regionCode) => patch({ regionCode }),
    addToCart: (id) =>
      setState((s) =>
        s.cart.includes(id) ? s : { ...s, cart: [...s.cart, id] },
      ),
    removeFromCart: (id) =>
      setState((s) => ({ ...s, cart: s.cart.filter((c) => c !== id) })),
    clearCart: () => patch({ cart: [], coupon: null }),
    inCart: (id) => state.cart.includes(id),
    setCoupon: (code) => patch({ coupon: code }),
    isEnrolled: (id) => state.enrolled.includes(id),
    enroll: (ids) =>
      setState((s) => ({
        ...s,
        enrolled: Array.from(new Set([...s.enrolled, ...ids])),
      })),
    toggleLesson: (courseId, lessonId) =>
      setState((s) => {
        const cur = s.progress[courseId] ?? [];
        const next = cur.includes(lessonId)
          ? cur.filter((l) => l !== lessonId)
          : [...cur, lessonId];
        return { ...s, progress: { ...s.progress, [courseId]: next } };
      }),
    isLessonDone: (courseId, lessonId) =>
      (state.progress[courseId] ?? []).includes(lessonId),
    completedCount: (courseId) => (state.progress[courseId] ?? []).length,
    getQuizResult: (courseId, lessonId) =>
      state.quizResults[quizKey(courseId, lessonId)],
    submitQuizAttempt: (courseId, lessonId, scorePercent, passScore) => {
      const key = quizKey(courseId, lessonId);
      const passed = scorePercent >= passScore;
      const prev = state.quizResults[key];
      const result: QuizResult = {
        bestScore: Math.max(prev?.bestScore ?? 0, scorePercent),
        lastScore: scorePercent,
        attempts: (prev?.attempts ?? 0) + 1,
        passed: passed || !!prev?.passed,
        lastAttemptAt: new Date().toISOString(),
      };
      setState((s) => {
        const curLessons = s.progress[courseId] ?? [];
        const nextLessons =
          passed && !curLessons.includes(lessonId)
            ? [...curLessons, lessonId]
            : curLessons;
        return {
          ...s,
          quizResults: { ...s.quizResults, [key]: result },
          progress: { ...s.progress, [courseId]: nextLessons },
        };
      });
      return result;
    },
    getMyReview: (courseId) => state.myReviews[courseId],
    submitReview: (courseId, rating, title, body) =>
      setState((s) => ({
        ...s,
        myReviews: {
          ...s.myReviews,
          [courseId]: {
            rating,
            title,
            body,
            date: new Date().toISOString().slice(0, 10),
          },
        },
      })),
    courses,
    getCourse: (id) => courses.find((c) => c.id === id),
    upsertCourse: (course) =>
      setState((s) => ({
        ...s,
        customCourses: { ...s.customCourses, [course.id]: course },
      })),
    deleteCourse: (id) =>
      setState((s) => ({
        ...s,
        deletedCourseIds: Array.from(new Set([...s.deletedCourseIds, id])),
      })),
    setCourseStatus: (id, status) =>
      setState((s) => {
        const existing =
          s.customCourses[id] ?? baseCourses.find((c) => c.id === id);
        if (!existing) return s;
        return {
          ...s,
          customCourses: {
            ...s.customCourses,
            [id]: { ...existing, status, updatedAt: new Date().toISOString() },
          },
        };
      }),
    reset: () => {
      const d = defaultState();
      setState(d);
    },

    // ── instructor program ──────────────────────────────────────────────
    currentInstructor: resolveInstructor(state, state.currentInstructorId),
    getInstructorById: (id) => resolveInstructor(state, id) ?? undefined,
    instructorStatusOf: (id) => instructorStatusOf(state, id),
    myCourses: state.currentInstructorId
      ? courses.filter((c) => c.instructorId === state.currentInstructorId)
      : [],
    loginAsInstructor: (instructorId = DEMO_INSTRUCTOR_ID) =>
      patch({ role: 'instructor', currentInstructorId: instructorId }),
    applyAsInstructor: (data) => {
      const id = `ins_app_${Math.random().toString(36).slice(2, 8)}`;
      const application: InstructorApplication = {
        id,
        name: data.name,
        email: data.email,
        expertise: data.expertise,
        headline: data.headline,
        bio: data.bio,
        sampleUrl: data.sampleUrl,
        appliedAt: new Date().toISOString(),
        status: 'pending',
      };
      setState((s) => ({
        ...s,
        role: 'instructor',
        currentInstructorId: id,
        instructorApplications: [application, ...s.instructorApplications],
      }));
      return id;
    },
    approveInstructor: (applicationId, note) =>
      setState((s) => {
        const app = s.instructorApplications.find((a) => a.id === applicationId);
        if (!app) return s;
        const existing = s.customInstructors[app.id];
        const fromApp: Instructor = {
          id: app.id,
          name: app.name,
          title: app.headline,
          avatar: '',
          bio: app.bio,
          rating: 0,
          students: 0,
          courses: 0,
          email: app.email,
          expertise: app.expertise,
          status: 'approved',
        };
        // keep any profile edits the applicant made while pending
        const profile: Instructor = { ...fromApp, ...existing, status: 'approved' };
        return {
          ...s,
          instructorApplications: s.instructorApplications.map((a) =>
            a.id === applicationId
              ? { ...a, status: 'approved', reviewedAt: new Date().toISOString(), note }
              : a,
          ),
          customInstructors: { ...s.customInstructors, [app.id]: profile },
        };
      }),
    rejectInstructor: (applicationId, note) =>
      setState((s) => ({
        ...s,
        instructorApplications: s.instructorApplications.map((a) =>
          a.id === applicationId
            ? { ...a, status: 'rejected', reviewedAt: new Date().toISOString(), note }
            : a,
        ),
      })),
    updateInstructorProfile: (partial) =>
      setState((s) => {
        const id = s.currentInstructorId;
        if (!id) return s;
        const base = resolveInstructor(s, id);
        if (!base) return s;
        return {
          ...s,
          customInstructors: {
            ...s.customInstructors,
            [id]: { ...base, ...partial },
          },
        };
      }),
  };

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

export { DEMO_STUDENT_ID };

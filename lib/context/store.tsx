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
import type { Course } from '@/types';

export type Role = 'guest' | 'student' | 'admin';

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
}

const STORAGE_KEY = 'SkillStream_state_v1';

function quizKey(courseId: string, lessonId: string) {
  return `${courseId}:${lessonId}`;
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
  reset: () => void;
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
    reset: () => {
      const d = defaultState();
      setState(d);
    },
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

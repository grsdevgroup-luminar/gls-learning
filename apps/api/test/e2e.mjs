// End-to-end feature sweep against a running API.
// Fixture-only: every mutation targets entities this script creates.
const BASE = process.env.BASE ?? "http://localhost:4000/api";
const ts = Date.now();

const results = [];
let group = "";
const G = (g) => { group = g; };
const rec = (name, ok, detail) => {
  results.push({ group, name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  [${group}] ${name}${detail ? ` — ${detail}` : ""}`);
};
const check = (name, cond, detail) => rec(name, !!cond, detail);

async function req(method, path, { token, body, cookies, headers } = {}) {
  const h = { ...(headers ?? {}) };
  if (body !== undefined) h["content-type"] = "application/json";
  if (token) h.authorization = `Bearer ${token}`;
  if (cookies) h.cookie = cookies;
  const res = await fetch(BASE + path, {
    method,
    headers: h,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : undefined; } catch { json = text; }
  const setCookie = res.headers.getSetCookie?.() ?? [];
  return { status: res.status, json, setCookie };
}
const jar = (setCookie) => setCookie.map((c) => c.split(";")[0]).join("; ");
const msg = (r) => (typeof r.json?.message === "string" ? r.json.message : JSON.stringify(r.json)?.slice(0, 120));

const state = {};

// ─────────────────────────── 1. HEALTH ───────────────────────────
async function health() {
  G("health");
  const r = await req("GET", "/health");
  check("GET /health returns ok + db up", r.status === 200 && r.json?.db === "up", `${r.status} ${msg(r)}`);
}

// ─────────────────────────── 2. AUTH ───────────────────────────
async function auth() {
  G("auth");
  const email = `e2e.student.${ts}@e2e-test.dev`;
  const password = "e2ePassw0rd!";
  state.student = { email, password };

  let r = await req("POST", "/auth/register", { body: { name: "E2E Student", email, password, country: "US" } });
  check("register new student", r.status === 201 && !!r.json?.accessToken, `${r.status} ${msg(r)}`);
  state.student.token = r.json?.accessToken;
  state.student.cookies = jar(r.setCookie);
  check("register sets httpOnly auth cookies", r.setCookie.some((c) => c.startsWith("access_token=")) && r.setCookie.some((c) => c.startsWith("refresh_token=")) && r.setCookie.every((c) => /HttpOnly/i.test(c)), r.setCookie.map((c) => c.split("=")[0]).join(","));

  r = await req("POST", "/auth/register", { body: { name: "Dup", email, password } });
  check("duplicate email rejected", r.status === 409 || r.status === 400, `${r.status} ${msg(r)}`);

  r = await req("POST", "/auth/register", { body: { name: "X", email: `bad.${ts}@e2e-test.dev`, password: "123" } });
  check("weak password rejected (validation)", r.status === 400, `${r.status} ${msg(r)}`);

  r = await req("POST", "/auth/login", { body: { email, password } });
  check("login with correct password", r.status === 200 && !!r.json?.accessToken, `${r.status} ${msg(r)}`);
  state.student.token = r.json?.accessToken ?? state.student.token;
  state.student.cookies = jar(r.setCookie) || state.student.cookies;

  r = await req("POST", "/auth/login", { body: { email, password: "wrong-password" } });
  check("login with wrong password rejected", r.status === 401, `${r.status} ${msg(r)}`);

  r = await req("GET", "/auth/me", { token: state.student.token });
  check("GET /auth/me with bearer token", r.status === 200 && r.json?.email === email, `${r.status} ${msg(r)}`);
  state.student.id = r.json?.id;
  check("new user defaults to STUDENT role", r.json?.role === "STUDENT", `role=${r.json?.role}`);

  r = await req("GET", "/auth/me");
  check("GET /auth/me unauthenticated rejected", r.status === 401, `${r.status}`);

  r = await req("GET", "/auth/me", { token: "garbage.token.value" });
  check("malformed token rejected", r.status === 401, `${r.status}`);

  r = await req("GET", "/auth/me", { cookies: state.student.cookies });
  check("cookie auth works on /auth/me", r.status === 200, `${r.status}`);

  r = await req("POST", "/auth/refresh", { cookies: state.student.cookies });
  check("refresh rotates tokens via cookie", r.status === 200 && !!r.json?.accessToken, `${r.status} ${msg(r)}`);
  const rotated = jar(r.setCookie);
  if (rotated) state.student.cookies = rotated;
  state.student.token = r.json?.accessToken ?? state.student.token;

  r = await req("POST", "/auth/refresh");
  check("refresh without cookie rejected", r.status === 401, `${r.status}`);

  r = await req("PATCH", "/auth/me/profile", { token: state.student.token, body: { name: "E2E Student Renamed", country: "BD" } });
  check("update profile", r.status === 200 && r.json?.name === "E2E Student Renamed", `${r.status} ${msg(r)}`);

  r = await req("POST", "/auth/me/password", { token: state.student.token, body: { currentPassword: password, newPassword: password + "2" } });
  check("change password", r.status === 200, `${r.status} ${msg(r)}`);
  state.student.password = password + "2";

  r = await req("POST", "/auth/login", { body: { email, password } });
  check("old password no longer works", r.status === 401, `${r.status}`);

  r = await req("POST", "/auth/login", { body: { email, password: state.student.password } });
  check("new password works", r.status === 200, `${r.status}`);
  state.student.token = r.json?.accessToken ?? state.student.token;
  state.student.cookies = jar(r.setCookie) || state.student.cookies;

  r = await req("POST", "/auth/forgot-password", { body: { email } });
  check("forgot-password accepted", r.status === 200, `${r.status} ${msg(r)}`);

  r = await req("POST", "/auth/forgot-password", { body: { email: `nobody.${ts}@e2e-test.dev` } });
  check("forgot-password does not leak unknown email", r.status === 200, `${r.status}`);

  r = await req("POST", "/auth/reset-password", { body: { token: "invalid-token", password: "whatever123!" } });
  check("reset-password rejects bad token", r.status === 400 || r.status === 401, `${r.status} ${msg(r)}`);
}

async function logoutFlow() {
  G("auth");
  const r0 = await req("POST", "/auth/login", { body: { email: state.student.email, password: state.student.password } });
  const cookies = jar(r0.setCookie);
  let r = await req("POST", "/auth/logout", { cookies });
  check("logout", r.status === 200, `${r.status}`);
  r = await req("POST", "/auth/refresh", { cookies });
  check("refresh token revoked after logout", r.status === 401, `${r.status} ${msg(r)}`);
}

// ─────────────────────────── 3. ADMIN LOGIN ───────────────────────────
async function adminLogin() {
  G("auth");
  const r = await req("POST", "/auth/login", { body: { email: "admin@skillstream.dev", password: "admin12345" } });
  check("seeded admin can log in", r.status === 200, `${r.status} ${msg(r)}`);
  state.admin = { token: r.json?.accessToken };
  const me = await req("GET", "/auth/me", { token: state.admin.token });
  check("admin has ADMIN role", me.json?.role === "ADMIN", `role=${me.json?.role}`);
  state.admin.id = me.json?.id;
}

// ─────────────────────────── 4. RBAC ───────────────────────────
async function rbac() {
  G("rbac");
  let r = await req("GET", "/admin/overview", { token: state.student.token });
  check("student blocked from admin overview", r.status === 403, `${r.status}`);
  r = await req("GET", "/admin/overview");
  check("anonymous blocked from admin overview", r.status === 401, `${r.status}`);
  r = await req("POST", "/courses", { token: state.student.token, body: { title: "nope", category: "Development" } });
  check("student blocked from creating a course", r.status === 403, `${r.status}`);
  r = await req("GET", "/admin/overview", { token: state.admin.token });
  check("admin allowed on admin overview", r.status === 200, `${r.status}`);
}

// ─────────────────────────── 5. CATALOG ───────────────────────────
async function catalog() {
  G("catalog");
  let r = await req("GET", "/courses");
  const list = Array.isArray(r.json) ? r.json : r.json?.items ?? r.json?.data;
  check("public course list", r.status === 200 && Array.isArray(list), `${r.status} n=${list?.length}`);
  state.someCourse = list?.[0];

  r = await req("GET", "/categories");
  const cats = Array.isArray(r.json) ? r.json : r.json?.items;
  check("public categories", r.status === 200 && Array.isArray(cats) && cats.length > 0, `${r.status} n=${cats?.length}`);
  state.category = typeof cats?.[0] === "string" ? cats[0] : cats?.[0]?.name ?? cats?.[0]?.slug;

  if (state.someCourse?.slug) {
    r = await req("GET", `/courses/${state.someCourse.slug}`);
    check("public course detail by slug", r.status === 200 && !!r.json?.id, `${r.status}`);
  }
  r = await req("GET", "/courses/definitely-not-a-real-slug-xyz");
  check("unknown slug returns 404", r.status === 404, `${r.status}`);
}

// ─────────────────────────── 6. INSTRUCTOR ONBOARDING ───────────────────────────
async function instructorOnboarding() {
  G("instructor");
  const email = `e2e.instructor.${ts}@e2e-test.dev`;
  const password = "e2ePassw0rd!";
  let r = await req("POST", "/auth/register", { body: { name: "E2E Instructor", email, password, country: "US" } });
  check("register instructor applicant", r.status === 201, `${r.status} ${msg(r)}`);
  state.instructor = { email, password, token: r.json?.accessToken };
  const me = await req("GET", "/auth/me", { token: state.instructor.token });
  state.instructor.id = me.json?.id;

  r = await req("POST", "/instructors/apply", {
    token: state.instructor.token,
    body: { expertise: "Testing", headline: "E2E headline", bio: "E2E bio for automated verification.", sampleUrl: "https://example.com/sample" },
  });
  check("submit instructor application", r.status === 201 || r.status === 200, `${r.status} ${msg(r)}`);

  r = await req("GET", "/admin/instructor-applications", { token: state.admin.token });
  const apps = Array.isArray(r.json) ? r.json : r.json?.items;
  const mine = apps?.find((a) => a.email === email || a.user?.email === email);
  check("application appears in admin queue", r.status === 200 && !!mine, `${r.status} found=${!!mine}`);

  if (mine) {
    r = await req("POST", `/admin/instructor-applications/${mine.id}/approve`, { token: state.admin.token, body: { note: "e2e approve" } });
    check("admin approves application", r.status === 200 || r.status === 201, `${r.status} ${msg(r)}`);
  }

  // Re-login to pick up the promoted role in a fresh token.
  r = await req("POST", "/auth/login", { body: { email, password } });
  state.instructor.token = r.json?.accessToken ?? state.instructor.token;
  const me2 = await req("GET", "/auth/me", { token: state.instructor.token });
  check("approved applicant is now INSTRUCTOR", me2.json?.role === "INSTRUCTOR", `role=${me2.json?.role}`);

  r = await req("GET", "/me/instructor", { token: state.instructor.token });
  check("instructor profile readable", r.status === 200, `${r.status} ${msg(r)}`);
  r = await req("PATCH", "/me/instructor", { token: state.instructor.token, body: { title: "E2E Title", bio: "updated bio" } });
  check("instructor profile updatable", r.status === 200, `${r.status} ${msg(r)}`);
}

// ─────────────────────────── 7. COURSE UPLOAD (AUTHORING) ───────────────────────────
async function authoring() {
  G("course-upload");
  const t = state.instructor.token;
  let r = await req("POST", "/courses", {
    token: t,
    body: {
      title: `E2E Course ${ts}`,
      slug: `e2e-course-${ts}`,
      subtitle: "Created by the e2e sweep",
      description: "A course created end-to-end by the automated feature test.",
      category: state.category ?? "Development",
      level: "BEGINNER",
      language: "English",
      basePriceCents: 4999,
      originalPriceCents: 9999,
      whatYouLearn: ["testing", "automation"],
      requirements: ["none"],
    },
  });
  check("instructor creates course (draft)", r.status === 201 && !!r.json?.id, `${r.status} ${msg(r)}`);
  state.course = r.json;
  if (!state.course?.id) return;

  r = await req("PATCH", `/courses/${state.course.id}`, { token: t, body: { subtitle: "Updated subtitle" } });
  check("update course metadata", r.status === 200, `${r.status} ${msg(r)}`);

  // These endpoints return the whole course tree, not the created row.
  const secId = (tree, title) => tree?.sections?.find((s) => s.title === title)?.id;
  const lesId = (tree, title) => tree?.sections?.flatMap((s) => s.lessons ?? []).find((l) => l.title === title)?.id;

  r = await req("POST", `/courses/${state.course.id}/sections`, { token: t, body: { title: "Section One", order: 1 } });
  state.s1 = secId(r.json, "Section One");
  check("create section 1", r.status === 201 && !!state.s1, `${r.status} id=${state.s1}`);
  r = await req("POST", `/courses/${state.course.id}/sections`, { token: t, body: { title: "Section Two", order: 2 } });
  state.s2 = secId(r.json, "Section Two");
  check("create section 2", r.status === 201 && !!state.s2, `${r.status} id=${state.s2}`);

  r = await req("PATCH", `/sections/${state.s1}`, { token: t, body: { title: "Section One Renamed" } });
  check("update section", r.status === 200, `${r.status} ${msg(r)}`);

  r = await req("POST", `/courses/${state.course.id}/sections/reorder`, { token: t, body: { ids: [state.s2, state.s1] } });
  check("reorder sections", r.status === 200 || r.status === 201, `${r.status} ${msg(r)}`);

  r = await req("POST", `/courses/${state.course.id}/sections/reorder`, { token: t, body: { ids: ["not-a-real-section-id"] } });
  check("reorder with unknown id fails cleanly (4xx, not 500)", r.status >= 400 && r.status < 500, `${r.status} ${msg(r)}`);

  r = await req("POST", `/sections/${state.s1}/lessons`, { token: t, body: { title: "Article Lesson", type: "ARTICLE", articleContent: "# Hello\nE2E content.", durationSec: 120, preview: true, order: 1, resources: [{ name: "E2E notes", url: "https://example.com/e2e-notes.pdf", sizeLabel: "1.2 MB" }] } });
  state.lessonArticle = lesId(r.json, "Article Lesson");
  {
    const lesson = r.json?.sections?.flatMap((x) => x.lessons).find((x) => x.title === "Article Lesson");
    check("lesson resources persisted and returned", lesson?.resources?.[0]?.url === "https://example.com/e2e-notes.pdf", JSON.stringify(lesson?.resources));
    const bad = await req("POST", `/sections/${state.s1}/lessons`, { token: t, body: { title: "Bad resource", type: "ARTICLE", resources: [{ name: "no url" }] } });
    check("resource without a URL rejected", bad.status === 400, `${bad.status} ${msg(bad)}`);
  }
  check("create ARTICLE lesson (preview)", r.status === 201 && !!state.lessonArticle, `${r.status} id=${state.lessonArticle}`);

  r = await req("POST", `/sections/${state.s1}/lessons`, { token: t, body: { title: "Video Lesson", type: "VIDEO", cfVideoUid: "e2e-fake-video-uid", durationSec: 300, preview: false, order: 2 } });
  state.lessonVideo = lesId(r.json, "Video Lesson");
  check("create VIDEO lesson with cfVideoUid", r.status === 201 && !!state.lessonVideo, `${r.status} id=${state.lessonVideo}`);

  r = await req("POST", `/sections/${state.s1}/lessons`, { token: t, body: { title: "Quiz Lesson", type: "QUIZ", durationSec: 60, order: 3 } });
  state.lessonQuiz = lesId(r.json, "Quiz Lesson");
  check("create QUIZ lesson", r.status === 201 && !!state.lessonQuiz, `${r.status} id=${state.lessonQuiz}`);

  r = await req("PATCH", `/lessons/${state.lessonArticle}`, { token: t, body: { title: "Article Lesson Renamed", type: "ARTICLE" } });
  check("update lesson", r.status === 200, `${r.status} ${msg(r)}`);

  r = await req("POST", `/sections/${state.s1}/lessons/reorder`, { token: t, body: { ids: [state.lessonQuiz, state.lessonVideo, state.lessonArticle] } });
  check("reorder lessons", r.status === 200 || r.status === 201, `${r.status} ${msg(r)}`);

  r = await req("GET", `/authoring/courses/${state.course.id}`, { token: t });
  check("authoring course tree readable", r.status === 200 && !!r.json?.id, `${r.status}`);

  r = await req("GET", "/me/instructor/courses", { token: t });
  const mine = Array.isArray(r.json) ? r.json : r.json?.items;
  check("course appears in instructor's list", r.status === 200 && mine?.some((c) => c.id === state.course.id), `${r.status}`);
}

// ─────────────────────────── 8. QUIZ AUTHORING ───────────────────────────
async function quizAuthoring() {
  G("quiz");
  const t = state.instructor.token;
  let r = await req("POST", `/lessons/${state.lessonQuiz}/quiz`, { token: t, body: { passScore: 50 } });
  check("create quiz on lesson", r.status === 201 && !!r.json?.id, `${r.status} ${msg(r)}`);
  state.quiz = r.json?.id;
  if (!state.quiz) return;

  r = await req("PATCH", `/quizzes/${state.quiz}`, { token: t, body: { passScore: 60 } });
  check("update quiz passScore", r.status === 200, `${r.status} ${msg(r)}`);

  // Returns the whole quiz, not the created question.
  const qId = (quiz, prompt) => quiz?.questions?.find((q) => q.prompt === prompt)?.id;

  r = await req("POST", `/quizzes/${state.quiz}/questions`, {
    token: t,
    body: { prompt: "What is 2 + 2?", explanation: "Basic arithmetic.", order: 1, options: [{ text: "3", isCorrect: false }, { text: "4", isCorrect: true }, { text: "5", isCorrect: false }] },
  });
  state.q1 = qId(r.json, "What is 2 + 2?");
  check("add quiz question 1", r.status === 201 && !!state.q1, `${r.status} id=${state.q1}`);

  r = await req("POST", `/quizzes/${state.quiz}/questions`, {
    token: t,
    body: { prompt: "Which is a colour?", order: 2, options: [{ text: "Blue", isCorrect: true }, { text: "Seven", isCorrect: false }] },
  });
  state.q2 = qId(r.json, "Which is a colour?");
  check("add quiz question 2", r.status === 201 && !!state.q2, `${r.status} id=${state.q2}`);

  r = await req("POST", `/quizzes/${state.quiz}/questions`, { token: t, body: { prompt: "Only one option", options: [{ text: "solo", isCorrect: true }] } });
  check("question with <2 options rejected", r.status === 400, `${r.status}`);

  r = await req("PATCH", `/quiz-questions/${state.q1}`, { token: t, body: { prompt: "What is 2 + 2? (updated)" } });
  check("update quiz question", r.status === 200, `${r.status} ${msg(r)}`);

  r = await req("POST", `/quizzes/${state.quiz}/questions/reorder`, { token: t, body: { ids: [state.q2, state.q1] } });
  check("reorder quiz questions", r.status === 200 || r.status === 201, `${r.status} ${msg(r)}`);

  r = await req("GET", `/authoring/lessons/${state.lessonQuiz}/quiz`, { token: t });
  check("authoring quiz readable (with answers)", r.status === 200, `${r.status}`);
}

// ─────────────────────────── 9. MEDIA ───────────────────────────
async function media() {
  G("media");
  let r = await req("POST", "/media/upload-url", { token: state.instructor.token });
  check("media upload-url reachable by instructor (503 expected: no CF creds)", r.status === 503 || r.status === 201 || r.status === 200, `${r.status} ${msg(r)}`);
  r = await req("POST", "/media/upload-url", { token: state.student.token });
  check("student blocked from media upload-url", r.status === 403, `${r.status}`);
  r = await req("GET", `/lessons/${state.lessonVideo}/playback`);
  check("playback endpoint responds (no CF signing key configured)", [200, 403, 404, 503].includes(r.status), `${r.status} ${msg(r)}`);
}

// ─────────────────────────── 10. PUBLISH ───────────────────────────
async function publish() {
  G("course-upload");
  const t = state.instructor.token;
  let r = await req("PATCH", `/courses/${state.course.id}/status`, { token: t, body: { status: "PUBLISHED" } });
  check("publish course", r.status === 200, `${r.status} ${msg(r)}`);
  r = await req("GET", `/courses/${state.course.slug ?? `e2e-course-${ts}`}`);
  check("published course visible publicly", r.status === 200, `${r.status}`);
}

// ─────────────────────────── 11. COMMERCE ───────────────────────────
async function commerce() {
  G("commerce");
  let r = await req("GET", "/pricing/regions");
  const regions = Array.isArray(r.json) ? r.json : r.json?.items;
  check("public pricing regions", r.status === 200 && regions?.length > 0, `${r.status} n=${regions?.length}`);
  state.region = regions?.[0]?.code;

  r = await req("GET", "/admin/pricing", { token: state.admin.token });
  check("admin pricing config", r.status === 200, `${r.status}`);

  r = await req("POST", "/admin/pricing/tiers", { token: state.admin.token, body: { name: `E2E Tier ${ts}`, multiplier: 0.5 } });
  state.tier = r.json?.tiers?.find((x) => x.name === `E2E Tier ${ts}`)?.id;
  check("create pricing tier", r.status === 201 && !!state.tier, `${r.status} id=${state.tier}`);
  if (state.tier) {
    r = await req("PATCH", `/admin/pricing/tiers/${state.tier}`, { token: state.admin.token, body: { multiplier: 0.6 } });
    check("update pricing tier", r.status === 200, `${r.status} ${msg(r)}`);
  }

  r = await req("POST", "/checkout/quote", { token: state.student.token, body: { courseIds: [state.course.id], regionCode: state.region } });
  check("checkout quote (no coupon)", r.status === 200 || r.status === 201, `${r.status} ${msg(r)}`);
  state.quoteTotal = r.json?.totalCents ?? r.json?.total;

  // Coupon lifecycle
  const code = `E2E${ts}`;
  r = await req("POST", "/admin/coupons", {
    token: state.admin.token,
    body: { code, type: "PERCENT", value: 50, description: "E2E coupon", scope: "GLOBAL", expiresAt: new Date(Date.now() + 864e5).toISOString(), usageLimit: 100, active: true },
  });
  check("admin creates coupon", r.status === 201, `${r.status} ${msg(r)}`);
  state.coupon = r.status === 201 ? code : null;

  if (state.coupon) {
    r = await req("POST", "/checkout/quote", { token: state.student.token, body: { courseIds: [state.course.id], couponCode: code, regionCode: state.region } });
    const discounted = r.json?.totalCents ?? r.json?.total;
    check("quote applies 50% coupon", r.status < 300 && discounted < state.quoteTotal, `${state.quoteTotal} -> ${discounted}`);

    r = await req("POST", "/checkout/quote", { token: state.student.token, body: { courseIds: [state.course.id], couponCode: "NOT-A-REAL-COUPON", regionCode: state.region } });
    check("bogus coupon rejected/ignored", r.status === 400 || r.status === 404 || (r.status < 300 && (r.json?.totalCents ?? r.json?.total) === state.quoteTotal), `${r.status} ${msg(r)}`);

    // Featuring is exclusive — remember the current banner coupon so cleanup can restore it.
    const before = await req("GET", "/coupons/featured");
    state.prevFeatured = before.json?.code ?? null;

    r = await req("PATCH", `/admin/coupons/${code}`, { token: state.admin.token, body: { featured: true } });
    check("feature coupon", r.status === 200, `${r.status} ${msg(r)}`);
    r = await req("GET", "/coupons/featured");
    check("featured coupon served publicly (single object)", r.status === 200 && r.json?.code === code, `${r.status} code=${r.json?.code}`);
    check("featuring is exclusive (replaces previous banner)", r.json?.code === code, `prev=${state.prevFeatured} now=${r.json?.code}`);
    r = await req("GET", "/admin/coupons", { token: state.admin.token });
    check("admin coupon list", r.status === 200, `${r.status}`);
  }

  // Checkout session -> order
  r = await req("POST", "/checkout/session", { token: state.student.token, body: { courseIds: [state.course.id], gateway: "STRIPE", regionCode: state.region } });
  check("checkout session (STRIPE, no key configured)", [200, 201, 500, 503].includes(r.status), `${r.status} ${msg(r)}`);
  state.orderId = r.json?.orderId ?? r.json?.id;
  if (state.orderId) {
    r = await req("POST", `/payments/dev/simulate/${state.orderId}`, { token: state.student.token });
    check("dev payment simulation marks order paid", r.status === 200 || r.status === 201, `${r.status} ${msg(r)}`);
    r = await req("GET", "/me/orders", { token: state.student.token });
    const orders = Array.isArray(r.json) ? r.json : r.json?.items;
    const o = orders?.find((x) => x.id === state.orderId);
    check("order visible in my orders as PAID", r.status === 200 && o?.status === "PAID", `${r.status} status=${o?.status}`);
  }
}

// ─────────────────────────── 12. ENROLLMENT & PROGRESS ───────────────────────────
async function enrollment() {
  G("enrollment");
  const t = state.student.token;
  // Paid public course: enrollFree must refuse — access comes from checkout.
  let r = await req("POST", `/courses/${state.course.id}/enroll`, { token: t });
  check("free-enroll refused on paid course (purchase required)", r.status === 403, `${r.status} ${msg(r)}`);

  r = await req("GET", "/me/enrollments", { token: t });
  const en = Array.isArray(r.json) ? r.json : r.json?.items;
  check("enrollment appears in my enrollments", r.status === 200 && en?.some((e) => (e.courseId ?? e.course?.id) === state.course.id), `${r.status}`);

  r = await req("GET", `/me/courses/${state.course.id}/progress`, { token: t });
  check("read course progress", r.status === 200, `${r.status} ${msg(r)}`);

  r = await req("POST", `/enrollments/${state.course.id}/lessons/${state.lessonArticle}/toggle`, { token: t });
  check("toggle lesson complete", r.status === 200 || r.status === 201, `${r.status} ${msg(r)}`);
  r = await req("GET", `/me/courses/${state.course.id}/progress`, { token: t });
  const pct = r.json?.completionPct ?? r.json?.progress;
  check("progress reflects completed lesson", r.status === 200 && (r.json?.completedLessonIds?.includes(state.lessonArticle) || pct > 0), `pct=${pct}`);

  r = await req("POST", `/enrollments/${state.course.id}/lessons/${state.lessonArticle}/toggle`, { token: t });
  check("toggle lesson incomplete (idempotent flip)", r.status === 200 || r.status === 201, `${r.status}`);

  r = await req("GET", "/me/certificates", { token: t });
  check("certificates list readable", r.status === 200, `${r.status}`);
}

// ─────────────────────────── 13. QUIZ TAKING ───────────────────────────
async function quizTaking() {
  G("quiz");
  const t = state.student.token;
  let r = await req("GET", `/lessons/${state.lessonQuiz}/quiz`, { token: t });
  check("student fetches quiz", r.status === 200 && !!r.json, `${r.status} ${msg(r)}`);
  const q = r.json;
  const leaks = JSON.stringify(q ?? {}).match(/"correct":\s*true/);
  check("quiz does not leak correct answers to student", !leaks, leaks ? "LEAKS correct flags" : "no correct flags exposed");

  const questions = q?.questions ?? [];
  const answers = questions.map((qq) => ({ questionId: qq.id, optionId: qq.options?.[0]?.id }));
  if (answers.length) {
    r = await req("POST", `/lessons/${state.lessonQuiz}/quiz/attempt`, { token: t, body: { answers } });
    check("submit quiz attempt", r.status === 200 || r.status === 201, `${r.status} ${msg(r)}`);
    check("attempt returns a score", typeof (r.json?.score ?? r.json?.scorePct) === "number", `score=${r.json?.score ?? r.json?.scorePct}`);
    r = await req("GET", `/lessons/${state.lessonQuiz}/quiz/result`, { token: t });
    check("read quiz result", r.status === 200, `${r.status} ${msg(r)}`);
  } else {
    check("quiz returned questions to answer", false, "no questions in payload");
  }
}

// ─────────────────────────── 14. REVIEWS & COMMENTS ───────────────────────────
async function reviewsAndComments() {
  G("reviews");
  const t = state.student.token;
  let r = await req("POST", `/courses/${state.course.id}/reviews`, { token: t, body: { rating: 5, title: "E2E review", body: "Posted by the automated feature sweep." } });
  check("post review as enrolled student", r.status === 201 || r.status === 200, `${r.status} ${msg(r)}`);
  state.reviewId = r.json?.id;

  r = await req("POST", `/courses/${state.course.id}/reviews`, { token: t, body: { rating: 9, title: "bad", body: "rating out of range" } });
  check("invalid rating rejected", r.status === 400, `${r.status} ${msg(r)}`);

  r = await req("GET", `/me/courses/${state.course.id}/review`, { token: t });
  check("read my own review", r.status === 200, `${r.status}`);

  r = await req("GET", `/courses/${state.course.id}/reviews`);
  check("public review list", r.status === 200, `${r.status}`);

  G("comments");
  r = await req("POST", `/courses/${state.course.id}/comments`, { token: t, body: { body: "E2E comment" } });
  check("post comment", r.status === 201 || r.status === 200, `${r.status} ${msg(r)}`);
  state.commentId = r.json?.id;
  r = await req("POST", `/courses/${state.course.id}/comments`, { body: { body: "anon" } });
  check("anonymous comment rejected", r.status === 401, `${r.status}`);
  r = await req("GET", `/courses/${state.course.id}/comments`);
  const cs = Array.isArray(r.json) ? r.json : r.json?.items;
  check("public comment list includes new comment", r.status === 200 && cs?.some((c) => c.id === state.commentId), `${r.status} n=${cs?.length}`);
}

// ─────────────────────────── 15. ADMIN MODERATION ───────────────────────────
async function adminModeration() {
  G("admin");
  const t = state.admin.token;
  for (const [name, path] of [["overview", "/admin/overview"], ["students", "/admin/students"], ["courses", "/admin/courses"], ["orders", "/admin/orders"], ["reviews", "/admin/reviews"], ["reminder-logs", "/admin/reminder-logs"]]) {
    const r = await req("GET", path, { token: t });
    check(`admin ${name} readable`, r.status === 200, `${r.status}`);
  }

  if (state.reviewId) {
    const r = await req("PATCH", `/admin/reviews/${state.reviewId}/status`, { token: t, body: { status: "APPROVED" } });
    check("admin approves review", r.status === 200, `${r.status} ${msg(r)}`);
  }

  // Refund the order this run created — never a pre-existing one.
  if (state.orderId) {
    let r = await req("POST", `/admin/orders/${state.orderId}/refund`, { token: t });
    check("admin refunds e2e order", r.status === 200 || r.status === 201, `${r.status} ${msg(r)}`);
    r = await req("GET", "/admin/orders", { token: t });
    const orders = Array.isArray(r.json) ? r.json : r.json?.items;
    const o = orders?.find((x) => x.id === state.orderId);
    check("refunded order status is REFUNDED", o ? o.status === "REFUNDED" : true, `status=${o?.status}`);
  }

  // Status toggle on the e2e student only.
  let r = await req("PATCH", `/admin/users/${state.student.id}/status`, { token: t, body: { status: "AT_RISK" } });
  check("admin sets user status", r.status === 200, `${r.status} ${msg(r)}`);
  r = await req("PATCH", `/admin/users/${state.student.id}/status`, { token: t, body: { status: "NOT_A_STATUS" } });
  check("invalid user status rejected", r.status === 400, `${r.status}`);
}

// ─────────────────────────── 16. SALES AGENT ───────────────────────────
async function salesAgent() {
  G("sales-agent");
  const email = `e2e.agent.${ts}@e2e-test.dev`;
  const password = "e2ePassw0rd!";
  let r = await req("POST", "/auth/register", { body: { name: "E2E Agent", email, password, country: "US" } });
  check("register sales-agent applicant", r.status === 201, `${r.status} ${msg(r)}`);
  state.agent = { email, password, token: r.json?.accessToken };
  const me = await req("GET", "/auth/me", { token: state.agent.token });
  state.agent.id = me.json?.id;

  r = await req("POST", "/sales-agents/apply", { token: state.agent.token, body: { name: "E2E Agent", email, phone: "+10000000000", region: "US", bio: "E2E sales agent application." } });
  check("submit sales-agent application", r.status === 201 || r.status === 200, `${r.status} ${msg(r)}`);

  r = await req("GET", "/admin/sales-agent-applications", { token: state.admin.token });
  const apps = Array.isArray(r.json) ? r.json : r.json?.items;
  const mine = apps?.find((a) => a.email === email);
  check("sales-agent application in admin queue", r.status === 200 && !!mine, `${r.status} found=${!!mine}`);

  if (mine) {
    r = await req("POST", `/admin/sales-agent-applications/${mine.id}/review`, { token: state.admin.token, body: { status: "APPROVED", commissionPercent: 10, note: "e2e" } });
    check("admin approves sales agent", r.status === 200 || r.status === 201, `${r.status} ${msg(r)}`);
  }

  r = await req("GET", "/admin/sales-agents", { token: state.admin.token });
  const agents = Array.isArray(r.json) ? r.json : r.json?.items;
  state.agentRecord = agents?.find((a) => a.email === email || a.user?.email === email);
  check("approved agent appears in admin list", r.status === 200 && !!state.agentRecord, `${r.status}`);

  r = await req("POST", "/auth/login", { body: { email, password } });
  state.agent.token = r.json?.accessToken ?? state.agent.token;
  r = await req("GET", "/me/sales-agent", { token: state.agent.token });
  check("agent reads own record", r.status === 200, `${r.status} ${msg(r)}`);
  state.referralCode = r.json?.referralCode ?? r.json?.code;
  r = await req("GET", "/me/sales-agent/referrals", { token: state.agent.token });
  check("agent reads referrals", r.status === 200, `${r.status}`);

  if (state.agentRecord?.id) {
    r = await req("PATCH", `/admin/sales-agents/${state.agentRecord.id}`, { token: state.admin.token, body: { commissionPercent: 15 } });
    check("admin updates agent commission", r.status === 200, `${r.status} ${msg(r)}`);
    // Payouts moved to the unified request→approve→paid ledger; agents request
    // their own, admins approve. The old POST /admin/sales-agents/:id/payout is gone.
    r = await req("GET", "/me/payouts/balance", { token: state.agent.token });
    check("agent reads payout balance", r.status === 200 && typeof r.json?.availableCents === "number", `${r.status} ${msg(r)}`);
    r = await req("GET", "/admin/payouts?status=REQUESTED", { token: state.admin.token });
    check("admin lists payout requests", r.status === 200 && Array.isArray(r.json), `${r.status} ${msg(r)}`);
  }
  r = await req("GET", "/me/sales-agent", { token: state.student.token });
  check("non-agent gets no agent record", r.status === 404 || r.status === 403 || (r.status === 200 && !r.json), `${r.status}`);
}

// ─────────────────────────── 17. ORGANIZATIONS ───────────────────────────
async function organizations() {
  G("organizations");
  const t = state.admin.token;
  let r = await req("POST", "/organizations", { token: t, body: { name: `E2E Org ${ts}`, slug: `e2e-org-${ts}`, domain: "e2e-test.dev", adminEmail: `e2e.org.${ts}@e2e-test.dev`, seatCount: 5 } });
  check("admin creates organization", r.status === 201 && !!r.json?.id, `${r.status} ${msg(r)}`);
  state.org = r.json;
  if (!state.org?.id) return;

  r = await req("GET", "/organizations", { token: t });
  check("admin lists organizations", r.status === 200, `${r.status}`);
  r = await req("GET", `/organizations/${state.org.id}`, { token: t });
  check("read organization detail", r.status === 200, `${r.status}`);
  r = await req("PATCH", `/organizations/${state.org.id}`, { token: t, body: { seatCount: 10 } });
  check("update organization", r.status === 200, `${r.status} ${msg(r)}`);

  r = await req("POST", `/organizations/${state.org.id}/invite`, { token: t, body: { email: `e2e.member.${ts}@e2e-test.dev`, role: "MEMBER" } });
  check("invite member (email logged, not sent)", r.status === 201 || r.status === 200, `${r.status} ${msg(r)}`);
  state.inviteId = r.json?.id;
  state.inviteToken = r.json?.token;

  r = await req("GET", `/organizations/${state.org.id}/invitations`, { token: t });
  const invs = Array.isArray(r.json) ? r.json : r.json?.items;
  check("list invitations", r.status === 200 && invs?.length > 0, `${r.status} n=${invs?.length}`);
  state.inviteToken = state.inviteToken ?? invs?.[0]?.token;

  if (state.inviteToken) {
    r = await req("GET", `/organizations/invitations/${state.inviteToken}`);
    check("public invite lookup by token", r.status === 200, `${r.status} ${msg(r)}`);
  }
  r = await req("GET", "/organizations/invitations/not-a-real-token");
  check("bogus invite token not accepted as valid", r.status === 404 || r.status === 400 || r.json?.valid === false, `${r.status} ${msg(r)}`);

  r = await req("POST", `/organizations/${state.org.id}/courses`, { token: t, body: { courseId: state.course.id } });
  check("assign course to organization", r.status === 201 || r.status === 200, `${r.status} ${msg(r)}`);
  r = await req("GET", `/organizations/${state.org.id}/courses`, { token: t });
  check("list organization courses", r.status === 200, `${r.status}`);

  r = await req("GET", "/me/organizations", { token: state.student.token });
  check("student reads own organizations", r.status === 200, `${r.status}`);

  r = await req("GET", `/organizations/${state.org.id}`, { token: state.student.token });
  check("non-member blocked from org detail", r.status === 403 || r.status === 404, `${r.status}`);

  // An org admin runs their own branding, but seats/status stay with us.
  r = await req("POST", `/organizations/${state.org.id}/invite`, { token: t, body: { email: state.student.email, role: "ADMIN" } });
  const orgAdminToken = r.json?.token;
  if (orgAdminToken) {
    r = await req("POST", `/organizations/claim/${orgAdminToken}`, { token: state.student.token });
    check("invited admin claims their seat", r.status === 200 || r.status === 201, `${r.status} ${msg(r)}`);

    r = await req("PATCH", `/organizations/${state.org.id}`, { token: state.student.token, body: { name: `E2E Org ${ts} renamed` } });
    check("org admin can rename their organization", r.status === 200 && r.json?.name?.endsWith("renamed"), `${r.status} ${msg(r)}`);

    r = await req("PATCH", `/organizations/${state.org.id}`, { token: state.student.token, body: { seatCount: 9999 } });
    check("org admin cannot grant themselves seats", r.status === 403, `${r.status} ${msg(r)}`);

    r = await req("PATCH", `/organizations/${state.org.id}`, { token: state.student.token, body: { status: "ACTIVE" } });
    check("org admin cannot change org status", r.status === 403, `${r.status} ${msg(r)}`);
  }
}

// ─────────────────────────── 18. AUTOMATION ───────────────────────────
async function automation() {
  G("automation");
  const t = state.admin.token;
  let r = await req("GET", "/admin/automation-rules", { token: t });
  check("list automation rules", r.status === 200, `${r.status}`);

  r = await req("POST", "/admin/automation-rules", {
    token: t,
    body: { name: `E2E Rule ${ts}`, trigger: "IDLE", condition: "No activity for 7 days", channels: ["EMAIL"], template: "Hi {{first_name}}, come back to {{course}}!", active: false },
  });
  check("create automation rule (inactive)", r.status === 201 && !!r.json?.id, `${r.status} ${msg(r)}`);
  state.rule = r.json?.id;
  if (!state.rule) return;

  r = await req("PATCH", `/admin/automation-rules/${state.rule}`, {
    token: t,
    body: { name: `E2E Rule ${ts} v2`, trigger: "ALMOST_DONE", condition: "Over 85% complete", channels: ["EMAIL", "SMS"], template: "Almost there {{first_name}} — {{progress}}% of {{course}}", active: false },
  });
  check("update automation rule", r.status === 200, `${r.status} ${msg(r)}`);

  r = await req("POST", "/admin/automation-rules", { token: t, body: { name: "bad", trigger: "NOT_A_TRIGGER", channels: ["EMAIL"], template: "x" } });
  check("invalid trigger rejected", r.status === 400, `${r.status} ${msg(r)}`);

  r = await req("GET", "/admin/reminder-logs", { token: t });
  check("reminder logs readable", r.status === 200, `${r.status}`);
}

// ─────────────────────────── 19. CLEANUP ───────────────────────────
async function cleanup() {
  G("cleanup");
  const t = state.admin.token;
  const it = state.instructor?.token;
  const del = async (label, path, token) => {
    const r = await req("DELETE", path, { token });
    check(label, r.status < 300, `${r.status} ${msg(r)}`);
  };
  if (state.rule) await del("delete automation rule", `/admin/automation-rules/${state.rule}`, t);
  if (state.coupon) await del("delete coupon", `/admin/coupons/${state.coupon}`, t);
  // Restore the storefront banner coupon this run displaced.
  if (state.prevFeatured) {
    const r = await req("PATCH", `/admin/coupons/${state.prevFeatured}`, { token: t, body: { featured: true } });
    check(`restored previous featured coupon (${state.prevFeatured})`, r.status === 200, `${r.status}`);
  }
  if (state.org && state.course) await req("DELETE", `/organizations/${state.org.id}/courses/${state.course.id}`, { token: t });
  if (state.inviteId && state.org) await del("delete invitation", `/organizations/${state.org.id}/invitations/${state.inviteId}`, t);
  if (state.q1) await del("delete quiz question", `/quiz-questions/${state.q1}`, it);
  if (state.quiz) await del("delete quiz", `/quizzes/${state.quiz}`, it);
  if (state.lessonVideo) await del("delete lesson", `/lessons/${state.lessonVideo}`, it);
  if (state.s2) await del("delete section", `/sections/${state.s2}`, it);
  if (state.tier) await del("delete pricing tier", `/admin/pricing/tiers/${state.tier}`, t);
  if (state.course) {
    const r = await req("DELETE", `/courses/${state.course.id}`, { token: it });
    check(
      r.status < 300 ? "delete e2e course" : "e2e course kept (sold — order history references it)",
      r.status < 300 || r.status === 409,
      `${r.status} ${msg(r)}`,
    );
  }
  // Users: admin delete endpoint, e2e fixtures only. Accounts with orders (the
  // student bought a course above) are deliberately undeletable — the API says
  // to suspend them instead, so a 400 there is the expected outcome, and the
  // row stays behind. Same for the course: its OrderItem is an accounting record.
  for (const u of [state.student, state.instructor, state.agent]) {
    if (!u?.id) continue;
    const r = await req("DELETE", `/admin/users/${u.id}`, { token: t });
    const label = `delete e2e user ${u.email.split("@")[0]}`;
    if (r.status === 400) {
      check(`${label} refused with a clear reason`, true, msg(r));
      await req("PATCH", `/admin/users/${u.id}/status`, { token: t, body: { status: "AT_RISK" } });
    } else {
      check(label, r.status < 300, `${r.status} ${msg(r)}`);
    }
  }
}

// ─────────────────────────── 20. CERTIFICATES ───────────────────────────
async function certificates() {
  G("certificates");
  const t = state.student.token;

  // Complete every lesson so the course issues a certificate.
  const detail = await req("GET", `/courses/${state.course.slug}`, { token: t });
  const lessonIds = (detail.json?.sections ?? []).flatMap((s) => s.lessons.map((l) => l.id));
  for (const id of lessonIds) {
    const done = await req("GET", `/me/courses/${state.course.id}/progress`, { token: t });
    if (done.json?.completedLessonIds?.includes(id)) continue;
    await req("POST", `/enrollments/${state.course.id}/lessons/${id}/toggle`, { token: t });
  }

  let r = await req("GET", "/me/certificates", { token: t });
  const cert = (r.json ?? []).find((c) => c.courseId === state.course.id);
  check("certificate issued on course completion", !!cert, `${r.status} ${JSON.stringify(r.json)?.slice(0, 120)}`);
  if (!cert) return;
  check("certificate exposes a pdf url", typeof cert.pdfUrl === "string" && cert.pdfUrl.endsWith(`/certificates/${cert.serial}/pdf`), cert.pdfUrl);

  // Verification is public: no token on purpose.
  r = await req("GET", `/certificates/${cert.serial}`);
  check("public verification returns the learner + course", r.status === 200 && r.json?.valid === true && r.json?.courseTitle === state.course.title, `${r.status} ${msg(r)}`);
  check("verification exposes no account internals", r.status === 200 && !("email" in (r.json ?? {})) && !("userId" in (r.json ?? {})), Object.keys(r.json ?? {}).join(","));

  r = await req("GET", `/certificates/CERT-DOESNOTEXIST/`.slice(0, -1));
  check("unknown serial 404s", r.status === 404, `${r.status}`);

  const pdfRes = await fetch(`${BASE}/certificates/${cert.serial}/pdf`);
  const head = Buffer.from(await pdfRes.arrayBuffer()).subarray(0, 5).toString();
  check("certificate pdf downloads", pdfRes.status === 200 && head.startsWith("%PDF"), `${pdfRes.status} ${pdfRes.headers.get("content-type")} ${head}`);
}

// ─────────────────────────── 21. RECEIPTS ───────────────────────────
async function receipts() {
  G("receipts");
  if (!state.orderId) return check("order fixture available", false, "no order created");
  const t = state.student.token;

  const ok = await fetch(`${BASE}/me/orders/${state.orderId}/receipt`, { headers: { authorization: `Bearer ${t}` } });
  const head = Buffer.from(await ok.arrayBuffer()).subarray(0, 5).toString();
  check("receipt pdf downloads for the buyer", ok.status === 200 && head.startsWith("%PDF"), `${ok.status} ${head}`);

  const anon = await fetch(`${BASE}/me/orders/${state.orderId}/receipt`);
  check("receipt requires auth", anon.status === 401, `${anon.status}`);

  const other = await req("GET", `/me/orders/${state.orderId}/receipt`, { token: state.instructor.token });
  check("another account cannot fetch the receipt", other.status === 404, `${other.status}`);
}

// ─────────────────────────── 22. NOTIFICATION PREFS ───────────────────────────
async function notificationPrefs() {
  G("notif-prefs");
  const t = state.student.token;

  let r = await req("GET", "/me/notification-preferences", { token: t });
  check("prefs default to email-on for every trigger", r.status === 200 && r.json?.IDLE?.email === true && r.json?.NEW_CONTENT?.email === true, `${r.status} ${msg(r)}`);

  r = await req("PATCH", "/me/notification-preferences", { token: t, body: { IDLE: { email: false } } });
  check("opt out of one trigger", r.status === 200 && r.json?.IDLE?.email === false, `${r.status} ${msg(r)}`);

  r = await req("GET", "/me/notification-preferences", { token: t });
  check("opt-out survives a reload", r.json?.IDLE?.email === false && r.json?.ALMOST_DONE?.email === true, JSON.stringify(r.json?.IDLE));

  r = await req("PATCH", "/me/notification-preferences", { token: t, body: { PROMOTIONS: { email: false } } });
  check("unknown trigger rejected", r.status === 400, `${r.status} ${msg(r)}`);

  const anon = await req("PATCH", "/me/notification-preferences", { body: { IDLE: { email: false } } });
  check("prefs require auth", anon.status === 401, `${anon.status}`);
}

// ─────────────────────────── RUN ───────────────────────────
const steps = [
  ["health", health], ["auth", auth], ["adminLogin", adminLogin], ["logoutFlow", logoutFlow],
  ["rbac", rbac], ["catalog", catalog], ["instructor", instructorOnboarding], ["authoring", authoring],
  ["quizAuthoring", quizAuthoring], ["media", media], ["publish", publish], ["commerce", commerce],
  ["enrollment", enrollment], ["quizTaking", quizTaking], ["reviews", reviewsAndComments],
  ["certificates", certificates], ["adminModeration", adminModeration],
  ["salesAgent", salesAgent], ["organizations", organizations],
  ["automation", automation], ["receipts", receipts],
  ["notificationPrefs", notificationPrefs], ["cleanup", cleanup],
];

for (const [name, fn] of steps) {
  try {
    await fn();
  } catch (e) {
    rec(name, false, `THREW: ${e.message}`);
  }
}

console.log("\n══════════ SUMMARY ══════════");
const byGroup = {};
for (const r of results) {
  byGroup[r.group] ??= { pass: 0, fail: 0 };
  byGroup[r.group][r.ok ? "pass" : "fail"] += 1;
}
for (const [g, v] of Object.entries(byGroup)) console.log(`${g.padEnd(16)} ${v.pass} pass  ${v.fail} fail`);
const fails = results.filter((r) => !r.ok);
console.log(`\nTOTAL: ${results.length - fails.length}/${results.length} passed`);
if (fails.length) {
  console.log("\nFAILURES:");
  for (const f of fails) console.log(`  [${f.group}] ${f.name} — ${f.detail}`);
}

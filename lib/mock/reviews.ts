import type { Review } from "@/types";

const names = [
  "Jordan M.", "Priya S.", "Liam O.", "Chen W.", "Fatima A.",
  "Noah K.", "Sofia R.", "Daniel T.", "Aisha B.", "Mateo G.",
  "Hana L.", "Omar F.", "Grace P.", "Tomas V.", "Yuki N.",
];
const titles = [
  "Exactly what I needed",
  "Best course on the topic",
  "Clear and practical",
  "Worth every penny",
  "Finally it clicked",
  "Great instructor",
  "A bit fast but excellent",
  "Highly recommend",
];
const bodies = [
  "The pacing is perfect and the projects are genuinely useful. I shipped something at work the same week.",
  "I've taken a lot of courses and this is the one that finally made the concepts stick. The examples are real-world.",
  "Loved how each lesson builds on the last. Never felt lost, and the instructor explains the 'why' not just the 'how'.",
  "Production quality is top notch and the content is up to date. The protected video player is smooth too.",
  "Could use one more advanced module, but what's here is excellent. Will definitely buy the instructor's other courses.",
  "Approachable without dumbing things down. The quizzes helped me catch gaps in my understanding.",
];

const courseIds = [
  "c_react", "c_ts", "c_ml", "c_design", "c_aws", "c_growth", "c_python", "c_design_adv",
];

let rid = 0;
function gen(courseId: string, count: number): Review[] {
  const out: Review[] = [];
  for (let i = 0; i < count; i++) {
    rid += 1;
    const rating = Math.random() < 0.78 ? 5 : Math.random() < 0.6 ? 4 : 3;
    const daysAgo = Math.floor(Math.random() * 220) + 2;
    const d = new Date("2026-06-23");
    d.setDate(d.getDate() - daysAgo);
    out.push({
      id: `r${rid}`,
      courseId,
      author: names[(rid + i) % names.length],
      avatar: "",
      rating,
      date: d.toISOString().slice(0, 10),
      title: titles[(rid * 3 + i) % titles.length],
      body: bodies[(rid * 2 + i) % bodies.length],
      status: i === 0 && courseId === "c_react" ? "pending" : "approved",
      helpful: Math.floor(Math.random() * 64),
    });
  }
  return out;
}

export const reviews: Review[] = courseIds.flatMap((id) => gen(id, 6));
// A couple pending for the moderation queue demo
reviews.push(
  {
    id: "r_pending1", courseId: "c_ml", author: "Kabir H.", avatar: "", rating: 2,
    date: "2026-06-20", title: "Audio issues in section 3",
    body: "Content is good but a few videos in section 3 have low audio. Can this be fixed?",
    status: "pending", helpful: 0,
  },
  {
    id: "r_pending2", courseId: "c_design", author: "Anon", avatar: "", rating: 1,
    date: "2026-06-22", title: "buy followers cheap >> spam-link.example",
    body: "promotional spam content here",
    status: "pending", helpful: 0,
  },
);

export function reviewsForCourse(courseId: string) {
  return reviews.filter((r) => r.courseId === courseId && r.status === "approved");
}
export const pendingReviews = reviews.filter((r) => r.status === "pending");

import type { Course, Section, Lesson } from "@/types";

let lid = 0;
function L(
  title: string,
  min: number,
  opts: { type?: Lesson["type"]; preview?: boolean; resources?: Lesson["resources"] } = {},
): Lesson {
  lid += 1;
  return {
    id: `l${lid}`,
    title,
    durationSec: Math.round(min * 60),
    type: opts.type ?? "video",
    preview: opts.preview,
    resources: opts.resources,
  };
}

function S(id: string, title: string, lessons: Lesson[]): Section {
  return { id, title, lessons };
}

export const courses: Course[] = [
  {
    id: "c_react",
    slug: "modern-react-masterclass",
    title: "Modern React Masterclass",
    subtitle: "Build production-grade apps with React 19, Server Components & Suspense",
    description:
      "Go from solid fundamentals to advanced patterns used at top product companies. You'll build a real app from scratch with the latest React features, learn state management that scales, and ship a polished, accessible UI.",
    category: "Development",
    level: "Intermediate",
    thumbnail: "react",
    instructorId: "ins_sara",
    basePrice: 89.99,
    originalPrice: 199.99,
    rating: 4.8,
    reviewCount: 4123,
    studentCount: 58420,
    language: "English",
    updatedAt: "2026-05-12",
    status: "published",
    bestseller: true,
    whatYouLearn: [
      "Architect large React apps with Server Components",
      "Master hooks, context, and modern state patterns",
      "Data fetching with Suspense and streaming",
      "Build accessible, reusable component libraries",
      "Performance profiling and optimization",
      "Testing strategies that actually catch bugs",
    ],
    requirements: ["Comfortable with JavaScript ES6+", "Basic HTML & CSS", "Node.js installed"],
    revenue: 384210,
    sections: [
      S("s1", "Getting Started", [
        L("Course overview & what you'll build", 6, { preview: true }),
        L("Setting up your environment", 11, { preview: true }),
        L("How React 19 thinks about rendering", 14),
      ]),
      S("s2", "Components & State", [
        L("Components, props, and composition", 18),
        L("State and the rules of hooks", 22),
        L("Effects without the footguns", 19),
        L("Knowledge check", 5, { type: "quiz" }),
      ]),
      S("s3", "Server Components & Data", [
        L("Server vs Client Components", 16),
        L("Streaming with Suspense", 21, { resources: [{ name: "starter-repo.zip", size: "2.4 MB" }] }),
        L("Mutations and form actions", 17),
      ]),
      S("s4", "Production Polish", [
        L("Accessibility from the start", 15),
        L("Performance profiling", 20),
        L("Deploying to the edge", 13),
      ]),
    ],
  },
  {
    id: "c_ts",
    slug: "typescript-deep-dive",
    title: "TypeScript Deep Dive",
    subtitle: "Type-safe code that scales — from generics to advanced inference",
    description:
      "Stop fighting the compiler and start using it as a superpower. This course covers the type system end to end with practical, real-world patterns.",
    category: "Development",
    level: "Advanced",
    thumbnail: "typescript",
    instructorId: "ins_sara",
    basePrice: 74.99,
    originalPrice: 149.99,
    rating: 4.7,
    reviewCount: 2890,
    studentCount: 41200,
    language: "English",
    updatedAt: "2026-04-02",
    status: "published",
    whatYouLearn: [
      "Master generics and conditional types",
      "Build fully type-safe APIs",
      "Advanced inference and template literal types",
      "Migrate large JS codebases safely",
    ],
    requirements: ["Working JavaScript knowledge", "Some TypeScript exposure helps"],
    revenue: 214900,
    sections: [
      S("s1", "Foundations", [
        L("Why types matter", 9, { preview: true }),
        L("The structural type system", 16),
      ]),
      S("s2", "Generics", [
        L("Generic functions & constraints", 19),
        L("Conditional & mapped types", 23),
        L("Quiz: type puzzles", 6, { type: "quiz" }),
      ]),
      S("s3", "Real-World Patterns", [
        L("Type-safe API clients", 21),
        L("Discriminated unions in practice", 18),
      ]),
    ],
  },
  {
    id: "c_ml",
    slug: "machine-learning-foundations",
    title: "Machine Learning Foundations",
    subtitle: "The math, intuition, and code behind modern ML — no PhD required",
    description:
      "Build a genuine understanding of how machine learning works. We balance intuition, the essential math, and hands-on Python so the concepts actually stick.",
    category: "Data Science",
    level: "Beginner",
    thumbnail: "ml",
    instructorId: "ins_marcus",
    basePrice: 99.99,
    originalPrice: 219.99,
    rating: 4.6,
    reviewCount: 3551,
    studentCount: 49800,
    language: "English",
    updatedAt: "2026-05-28",
    status: "published",
    bestseller: true,
    whatYouLearn: [
      "The intuition behind core ML algorithms",
      "Train and evaluate models in Python",
      "Avoid overfitting and data leakage",
      "Feature engineering that moves the needle",
      "Deploy a model as an API",
    ],
    requirements: ["Basic Python", "High-school math"],
    revenue: 498000,
    sections: [
      S("s1", "Orientation", [
        L("What ML can and can't do", 12, { preview: true }),
        L("Your Python toolkit", 14, { preview: true }),
      ]),
      S("s2", "Supervised Learning", [
        L("Linear & logistic regression", 24),
        L("Decision trees & ensembles", 26),
        L("Evaluating models properly", 19),
        L("Checkpoint quiz", 7, { type: "quiz" }),
      ]),
      S("s3", "Putting It to Work", [
        L("Feature engineering", 22),
        L("Serving a model as an API", 20),
      ]),
    ],
  },
  {
    id: "c_design",
    slug: "product-design-essentials",
    title: "Product Design Essentials",
    subtitle: "Design interfaces people love — research, UX, and beautiful UI",
    description:
      "A complete, practical introduction to product design. Learn the process real teams use to go from a fuzzy problem to a shipped, delightful interface.",
    category: "Design",
    level: "All Levels",
    thumbnail: "design",
    instructorId: "ins_amina",
    basePrice: 69.99,
    originalPrice: 159.99,
    rating: 4.9,
    reviewCount: 5102,
    studentCount: 62100,
    language: "English",
    updatedAt: "2026-06-01",
    status: "published",
    bestseller: true,
    whatYouLearn: [
      "Run lightweight user research",
      "Information architecture & flows",
      "Visual hierarchy, type, and color",
      "Design systems and components",
      "Prototyping and handoff",
    ],
    requirements: ["No experience needed", "Any design tool (Figma recommended)"],
    revenue: 521800,
    sections: [
      S("s1", "Foundations of UX", [
        L("What product design really is", 10, { preview: true }),
        L("Understanding your users", 17),
      ]),
      S("s2", "From Problem to Flow", [
        L("Information architecture", 19),
        L("Wireframing flows", 21),
      ]),
      S("s3", "Beautiful UI", [
        L("Type, color & spacing", 23),
        L("Building a design system", 25),
        L("Prototyping & handoff", 18),
      ]),
    ],
  },
  {
    id: "c_aws",
    slug: "aws-cloud-practitioner",
    title: "AWS for Developers",
    subtitle: "Deploy, scale, and secure real apps on AWS with confidence",
    description:
      "Cut through the 200+ AWS services and learn the handful you actually need to ship and run production applications.",
    category: "Cloud",
    level: "Intermediate",
    thumbnail: "aws",
    instructorId: "ins_diego",
    basePrice: 84.99,
    originalPrice: 179.99,
    rating: 4.6,
    reviewCount: 1980,
    studentCount: 33400,
    language: "English",
    updatedAt: "2026-03-19",
    status: "published",
    whatYouLearn: [
      "Core compute, storage, and networking",
      "Deploy containers with ECS & Fargate",
      "Infrastructure as code with CDK",
      "Security and cost best practices",
    ],
    requirements: ["Basic command line", "Some backend experience"],
    revenue: 178600,
    sections: [
      S("s1", "AWS Fundamentals", [
        L("The mental model of AWS", 13, { preview: true }),
        L("IAM and security basics", 18),
      ]),
      S("s2", "Compute & Containers", [
        L("EC2, Lambda, and when to use each", 22),
        L("Containers on ECS/Fargate", 24),
      ]),
      S("s3", "Production", [
        L("Infrastructure as code with CDK", 26),
        L("Monitoring and cost control", 17),
      ]),
    ],
  },
  {
    id: "c_growth",
    slug: "growth-marketing-for-founders",
    title: "Growth Marketing for Founders",
    subtitle: "Acquire users and grow revenue without a big budget",
    description:
      "A no-fluff playbook for technical founders who need to grow. Channels, funnels, experiments, and the metrics that matter.",
    category: "Marketing",
    level: "Beginner",
    thumbnail: "growth",
    instructorId: "ins_priya",
    basePrice: 59.99,
    originalPrice: 129.99,
    rating: 4.7,
    reviewCount: 1340,
    studentCount: 21900,
    language: "English",
    updatedAt: "2026-02-10",
    status: "published",
    whatYouLearn: [
      "Find your highest-leverage channel",
      "Build and instrument a funnel",
      "Run growth experiments",
      "Email & lifecycle marketing",
    ],
    requirements: ["A product or idea to grow"],
    revenue: 96400,
    sections: [
      S("s1", "Growth Mindset", [
        L("How growth really works", 11, { preview: true }),
        L("Picking your first channel", 16),
      ]),
      S("s2", "The Funnel", [
        L("Instrumenting your funnel", 19),
        L("Running experiments", 21),
      ]),
    ],
  },
  {
    id: "c_python",
    slug: "python-for-everybody",
    title: "Python for Everybody",
    subtitle: "Your friendly first step into programming with Python",
    description:
      "Brand new to coding? Start here. Build real, useful scripts while learning to think like a programmer.",
    category: "Development",
    level: "Beginner",
    thumbnail: "python",
    instructorId: "ins_marcus",
    basePrice: 49.99,
    originalPrice: 119.99,
    rating: 4.8,
    reviewCount: 8720,
    studentCount: 98200,
    language: "English",
    updatedAt: "2026-01-22",
    status: "published",
    bestseller: true,
    whatYouLearn: [
      "Core programming concepts",
      "Work with files and data",
      "Automate boring tasks",
      "Build your first real project",
    ],
    requirements: ["A computer — that's it"],
    revenue: 312000,
    sections: [
      S("s1", "Hello, Python", [
        L("Installing Python", 8, { preview: true }),
        L("Variables and types", 14, { preview: true }),
      ]),
      S("s2", "Building Blocks", [
        L("Loops and conditionals", 18),
        L("Functions", 16),
        L("Quiz", 5, { type: "quiz" }),
      ]),
      S("s3", "Real Projects", [
        L("Working with files", 17),
        L("Automating a task", 20),
      ]),
    ],
  },
  {
    id: "c_design_adv",
    slug: "design-systems-at-scale",
    title: "Design Systems at Scale",
    subtitle: "Build and govern a design system multiple teams can trust",
    description:
      "Take your design and frontend skills to the next level by building a robust, well-documented design system.",
    category: "Design",
    level: "Advanced",
    thumbnail: "system",
    instructorId: "ins_amina",
    basePrice: 94.99,
    originalPrice: 189.99,
    rating: 4.8,
    reviewCount: 760,
    studentCount: 12400,
    language: "English",
    updatedAt: "2026-06-15",
    status: "draft",
    whatYouLearn: [
      "Token architecture",
      "Component API design",
      "Documentation and governance",
      "Versioning and adoption",
    ],
    requirements: ["Solid UI design or frontend experience"],
    revenue: 0,
    sections: [
      S("s1", "Foundations", [
        L("Why design systems", 12, { preview: true }),
        L("Design tokens", 19),
      ]),
      S("s2", "Components", [L("Component API design", 23), L("Documentation", 18)]),
    ],
  },
];

export function getCourse(slug: string) {
  return courses.find((c) => c.slug === slug);
}
export function getCourseById(id: string) {
  return courses.find((c) => c.id === id);
}
export const publishedCourses = courses.filter((c) => c.status === "published");
export const categories = Array.from(new Set(courses.map((c) => c.category)));

export function courseDurationMin(course: Course) {
  return Math.round(
    course.sections.reduce(
      (sum, s) => sum + s.lessons.reduce((a, l) => a + l.durationSec, 0),
      0,
    ) / 60,
  );
}
export function courseLessonCount(course: Course) {
  return course.sections.reduce((a, s) => a + s.lessons.length, 0);
}

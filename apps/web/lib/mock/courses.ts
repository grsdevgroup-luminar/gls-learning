import type { Course, Section, Lesson, Quiz, QuizQuestion } from "@/types";

let lid = 0;
let qid = 0;
function Q(
  prompt: string,
  options: string[],
  correctIndex: number,
  explanation?: string,
): QuizQuestion {
  qid += 1;
  return {
    id: `q${qid}`,
    prompt,
    options: options.map((text, i) => ({ id: `q${qid}o${i}`, text })),
    correctOptionId: `q${qid}o${correctIndex}`,
    explanation,
  };
}

function L(
  title: string,
  min: number,
  opts: {
    type?: Lesson["type"];
    preview?: boolean;
    resources?: Lesson["resources"];
    quiz?: Quiz;
  } = {},
): Lesson {
  lid += 1;
  return {
    id: `l${lid}`,
    title,
    durationSec: Math.round(min * 60),
    type: opts.type ?? "video",
    preview: opts.preview,
    resources: opts.resources,
    quiz: opts.quiz,
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
        L("Knowledge check", 5, {
          type: "quiz",
          quiz: {
            passScore: 70,
            questions: [
              Q(
                "What triggers a React component to re-render?",
                ["Changing a local variable", "A state or props update", "Calling console.log", "Resizing the browser"],
                1,
                "Re-renders are driven by state or prop changes, not arbitrary local variables.",
              ),
              Q(
                "Which hook lets you run code after the DOM has been updated?",
                ["useMemo", "useRef", "useEffect", "useState"],
                2,
                "useEffect runs after render, making it the place for side effects tied to DOM updates.",
              ),
              Q(
                "What's the main benefit of Server Components?",
                ["They run only in the browser", "They reduce client bundle size by rendering on the server", "They replace the need for state", "They disable hydration"],
                1,
              ),
            ],
          },
        }),
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
        L("Quiz: type puzzles", 6, {
          type: "quiz",
          quiz: {
            passScore: 70,
            questions: [
              Q(
                "What does the `keyof` operator produce?",
                ["A union of an object's value types", "A union of an object's property names", "An array of values", "A new class"],
                1,
              ),
              Q(
                "Which utility type makes all properties optional?",
                ["Required<T>", "Readonly<T>", "Partial<T>", "Pick<T, K>"],
                2,
              ),
              Q(
                "Conditional types use which syntax?",
                ["T extends U ? X : Y", "T instanceof U", "T matches U", "switch (T)"],
                0,
              ),
            ],
          },
        }),
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
        L("Checkpoint quiz", 7, {
          type: "quiz",
          quiz: {
            passScore: 70,
            questions: [
              Q(
                "Overfitting means a model:",
                ["Performs well on both train and test data", "Performs well on training data but poorly on new data", "Trains too slowly", "Has too few parameters"],
                1,
              ),
              Q(
                "Which metric is most useful for an imbalanced classification problem?",
                ["Accuracy", "F1 score", "Mean squared error", "R-squared"],
                1,
              ),
              Q(
                "What is the purpose of a validation set?",
                ["To train the final model", "To tune hyperparameters without touching the test set", "To replace the test set entirely", "To visualize raw data"],
                1,
              ),
            ],
          },
        }),
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
        L("Quiz", 5, {
          type: "quiz",
          quiz: {
            passScore: 70,
            questions: [
              Q(
                "Which keyword starts a function definition in Python?",
                ["func", "def", "function", "lambda"],
                1,
              ),
              Q(
                "What does `for i in range(5):` iterate over?",
                ["0 through 4", "1 through 5", "0 through 5", "1 through 4"],
                0,
              ),
              Q(
                "Which data type is mutable in Python?",
                ["tuple", "str", "list", "int"],
                2,
              ),
            ],
          },
        }),
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
  {
    id: "c_speaking",
    slug: "confident-public-speaking",
    title: "Confident Public Speaking",
    subtitle: "Speak with clarity and presence — in meetings, on stage, anywhere",
    description:
      "Most people fear public speaking more than almost anything else. This course breaks the skill into practical, repeatable habits — so you can walk into any room, meeting, or stage and speak with genuine confidence.",
    category: "Communication",
    level: "Beginner",
    thumbnail: "speaking",
    instructorId: "ins_james",
    basePrice: 54.99,
    originalPrice: 119.99,
    rating: 4.8,
    reviewCount: 2210,
    studentCount: 39600,
    language: "English",
    updatedAt: "2026-06-08",
    status: "published",
    bestseller: true,
    whatYouLearn: [
      "Calm nervous energy before you speak",
      "Structure a talk people actually remember",
      "Use your voice and body language with intention",
      "Handle Q&A and unexpected questions gracefully",
      "Tell stories that land",
    ],
    requirements: ["No experience needed", "Willingness to practice out loud"],
    revenue: 142300,
    sections: [
      S("s1", "Overcoming the Fear", [
        L("Why public speaking feels so scary", 9, { preview: true }),
        L("Reframing nervous energy", 12, { preview: true }),
      ]),
      S("s2", "Structure & Delivery", [
        L("The 3-part structure that always works", 16),
        L("Voice, pacing, and pauses", 14),
        L("Body language that builds trust", 13),
        L("Knowledge check", 5, {
          type: "quiz",
          quiz: {
            passScore: 70,
            questions: [
              Q(
                "What's the most effective way to open a talk?",
                ["A long list of credentials", "A relevant story or question", "An apology for being nervous", "Reading the agenda aloud"],
                1,
              ),
              Q(
                "Pausing while speaking mainly helps the audience:",
                ["Get bored", "Absorb and process what you said", "Lose interest", "Forget the topic"],
                1,
              ),
              Q(
                "The best way to handle a question you can't answer is to:",
                ["Make something up confidently", "Admit it and offer to follow up", "Ignore the question", "Change the subject abruptly"],
                1,
              ),
            ],
          },
        }),
      ]),
      S("s3", "Putting It Into Practice", [
        L("Handling Q&A with grace", 15),
        L("Speaking on camera vs. in person", 12),
        L("Your 5-minute practice talk", 18),
      ]),
    ],
  },
  {
    id: "c_social",
    slug: "mastering-social-skills",
    title: "Mastering Social Skills & Small Talk",
    subtitle: "Build genuine connections, navigate any room, never run out of things to say",
    description:
      "Social skills aren't a personality trait — they're a learnable skill. Learn how to start conversations, keep them flowing, read social cues, and build real connections, whether you're at a networking event, a party, or meeting new coworkers.",
    category: "Personal Development",
    level: "All Levels",
    thumbnail: "social",
    instructorId: "ins_lena",
    basePrice: 49.99,
    originalPrice: 109.99,
    rating: 4.9,
    reviewCount: 3340,
    studentCount: 51200,
    language: "English",
    updatedAt: "2026-05-30",
    status: "published",
    bestseller: true,
    whatYouLearn: [
      "Start conversations without feeling awkward",
      "Keep small talk going naturally",
      "Read body language and social cues",
      "Build deeper connections beyond surface talk",
      "Navigate group settings and networking events",
    ],
    requirements: ["No experience needed"],
    revenue: 156800,
    sections: [
      S("s1", "The Basics of Connection", [
        L("Why small talk matters more than you think", 8, { preview: true }),
        L("Opening a conversation with anyone", 13, { preview: true }),
      ]),
      S("s2", "Keeping the Conversation Alive", [
        L("Asking questions people love answering", 15),
        L("Active listening that actually shows", 14),
        L("Reading body language", 16),
      ]),
      S("s3", "From Acquaintance to Friend", [
        L("Moving past small talk", 17),
        L("Navigating group settings", 14),
        L("Following up without feeling weird", 11),
      ]),
    ],
  },
  {
    id: "c_eq",
    slug: "emotional-intelligence-for-relationships",
    title: "Emotional Intelligence for Relationships",
    subtitle: "Understand your emotions, manage conflict, and connect more deeply",
    description:
      "Emotional intelligence is the single biggest predictor of healthy relationships — romantic, family, and friendships alike. Learn to recognize your own emotional patterns, regulate them under stress, and respond to others with empathy instead of reactivity.",
    category: "Personal Development",
    level: "Beginner",
    thumbnail: "social",
    instructorId: "ins_lena",
    basePrice: 59.99,
    originalPrice: 129.99,
    rating: 4.9,
    reviewCount: 1870,
    studentCount: 28400,
    language: "English",
    updatedAt: "2026-04-18",
    status: "published",
    whatYouLearn: [
      "Recognize your own emotional triggers",
      "Regulate emotions under stress",
      "Communicate needs without blame",
      "Resolve conflict without damaging trust",
      "Build empathy in everyday interactions",
    ],
    requirements: ["No experience needed", "Openness to self-reflection"],
    revenue: 88900,
    sections: [
      S("s1", "Know Yourself", [
        L("What emotional intelligence actually is", 11, { preview: true }),
        L("Identifying your emotional triggers", 15),
      ]),
      S("s2", "Manage & Respond", [
        L("Regulating emotions in the moment", 16),
        L("Communicating needs without blame", 14),
        L("Quiz: EQ in practice", 5, {
          type: "quiz",
          quiz: {
            passScore: 70,
            questions: [
              Q(
                "Emotional intelligence is best described as:",
                ["A fixed personality trait", "A learnable, practicable skill", "Only relevant at work", "The absence of emotion"],
                1,
              ),
              Q(
                "Which response best shows empathy during a disagreement?",
                ["Reflecting back what the other person feels", "Immediately defending your position", "Changing the subject", "Pointing out who's right"],
                0,
              ),
            ],
          },
        }),
      ]),
      S("s3", "Deepen Connection", [
        L("Resolving conflict without damaging trust", 18),
        L("Building everyday empathy", 13),
      ]),
    ],
  },
  {
    id: "c_finance",
    slug: "personal-finance-mastery",
    title: "Personal Finance Mastery",
    subtitle: "Budget, save, invest, and build real wealth — explained simply",
    description:
      "No jargon, no sales pitch — just a clear, practical path to financial control. Learn how to budget without misery, build an emergency fund, pay off debt strategically, and start investing with confidence.",
    category: "Finance",
    level: "Beginner",
    thumbnail: "finance",
    instructorId: "ins_carlos",
    basePrice: 64.99,
    originalPrice: 139.99,
    rating: 4.8,
    reviewCount: 4210,
    studentCount: 67300,
    language: "English",
    updatedAt: "2026-06-02",
    status: "published",
    bestseller: true,
    whatYouLearn: [
      "Build a budget you'll actually stick to",
      "Pay off debt with a clear strategy",
      "Build a 3-6 month emergency fund",
      "Start investing in index funds with confidence",
      "Avoid the most common money mistakes",
    ],
    requirements: ["No financial background needed"],
    revenue: 198400,
    sections: [
      S("s1", "Getting Control", [
        L("Why budgets fail (and how to fix that)", 10, { preview: true }),
        L("Building a budget you'll keep", 16, { preview: true }),
      ]),
      S("s2", "Debt & Safety Net", [
        L("Paying off debt strategically", 18),
        L("Building your emergency fund", 13),
        L("Checkpoint quiz", 6, {
          type: "quiz",
          quiz: {
            passScore: 70,
            questions: [
              Q(
                "Which debt payoff strategy targets the highest-interest debt first?",
                ["Snowball method", "Avalanche method", "Minimum-only method", "Consolidation only"],
                1,
              ),
              Q(
                "A typical emergency fund should cover:",
                ["One week of expenses", "3-6 months of expenses", "One year of luxury spending", "Nothing — credit cards are enough"],
                1,
              ),
              Q(
                "What is compound interest?",
                ["Interest paid only on the original deposit", "Interest earned on both the principal and previously earned interest", "A bank fee", "A type of tax"],
                1,
              ),
            ],
          },
        }),
      ]),
      S("s3", "Growing Wealth", [
        L("Investing basics: index funds & ETFs", 22),
        L("Retirement accounts explained", 17),
        L("Avoiding common money mistakes", 14),
      ]),
    ],
  },
  {
    id: "c_mindfulness",
    slug: "mindfulness-and-stress-management",
    title: "Mindfulness & Stress Management",
    subtitle: "Practical tools to stay calm, focused, and present in a busy life",
    description:
      "Build a sustainable mindfulness practice that fits into a real, busy life. Learn evidence-based techniques to manage stress, improve focus, and respond to life's pressures with more calm and less reactivity.",
    category: "Health & Wellness",
    level: "All Levels",
    thumbnail: "mindfulness",
    instructorId: "ins_noor",
    basePrice: 44.99,
    originalPrice: 99.99,
    rating: 4.9,
    reviewCount: 2980,
    studentCount: 45100,
    language: "English",
    updatedAt: "2026-05-21",
    status: "published",
    whatYouLearn: [
      "Build a daily mindfulness practice that sticks",
      "Manage stress in the moment, not just after",
      "Improve focus and reduce mental clutter",
      "Sleep better through evening wind-down routines",
      "Respond to pressure instead of reacting to it",
    ],
    requirements: ["No experience needed", "A quiet space for 10 minutes a day"],
    revenue: 121700,
    sections: [
      S("s1", "Foundations of Mindfulness", [
        L("What mindfulness really is (and isn't)", 8, { preview: true }),
        L("Your first 5-minute practice", 9, { preview: true }),
      ]),
      S("s2", "Managing Stress in Real Time", [
        L("The physiology of stress", 14),
        L("Breathing techniques that work fast", 11),
        L("Reframing stressful thoughts", 15),
      ]),
      S("s3", "Building Lasting Habits", [
        L("Designing a daily practice that sticks", 13),
        L("Better sleep through wind-down routines", 12),
      ]),
    ],
  },
  {
    id: "c_spanish",
    slug: "conversational-spanish-for-travelers",
    title: "Conversational Spanish for Travelers",
    subtitle: "Speak real, useful Spanish in weeks — not years of grammar drills",
    description:
      "Skip the textbook grammar grind. Learn the actual phrases, listening skills, and confidence you need to order food, ask for directions, and have real conversations on your next trip.",
    category: "Language Learning",
    level: "Beginner",
    thumbnail: "language",
    instructorId: "ins_yuki",
    basePrice: 39.99,
    originalPrice: 89.99,
    rating: 4.7,
    reviewCount: 1650,
    studentCount: 29800,
    language: "English",
    updatedAt: "2026-03-30",
    status: "published",
    whatYouLearn: [
      "Hold a basic conversation within weeks",
      "Order food, ask directions, and handle travel basics",
      "Understand spoken Spanish at a natural pace",
      "Build vocabulary that's actually useful",
      "Sound confident, not robotic",
    ],
    requirements: ["No prior Spanish needed"],
    revenue: 67200,
    sections: [
      S("s1", "First Words & Phrases", [
        L("Greetings and introductions", 9, { preview: true }),
        L("Numbers, time, and dates", 12, { preview: true }),
      ]),
      S("s2", "Real-World Situations", [
        L("Ordering food and drinks", 14),
        L("Asking for directions", 13),
        L("Quiz: everyday phrases", 5, {
          type: "quiz",
          quiz: {
            passScore: 70,
            questions: [
              Q(
                "How do you say 'Where is the bathroom?' in Spanish?",
                ["¿Dónde está el baño?", "¿Cómo te llamas?", "¿Qué hora es?", "¿Cuánto cuesta?"],
                0,
              ),
              Q(
                "Which phrase means 'I would like...'?",
                ["Me gusta", "Quisiera", "Lo siento", "De nada"],
                1,
              ),
            ],
          },
        }),
      ]),
      S("s3", "Building Confidence", [
        L("Listening to natural-speed conversations", 16),
        L("Small talk in Spanish", 14),
      ]),
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

// Curriculum stat helpers moved to `lib/course-stats.ts` — they work off the
// API's Course shape now, and this file is seed fixture data only.

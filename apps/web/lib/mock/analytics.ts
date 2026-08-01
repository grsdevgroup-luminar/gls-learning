// Aggregated metrics for the admin dashboards (seeded so charts look alive).

export const kpis = {
  revenue: 248930,
  revenueDelta: 12.4,
  enrollments: 8742,
  enrollmentsDelta: 8.1,
  activeStudents: 5310,
  activeStudentsDelta: 4.6,
  completionRate: 61,
  completionRateDelta: 2.3,
  refundRate: 1.8,
  mrr: 41200,
};

export const revenueSeries = [
  { month: "Jan", revenue: 28100, enrollments: 920 },
  { month: "Feb", revenue: 31200, enrollments: 1010 },
  { month: "Mar", revenue: 29800, enrollments: 980 },
  { month: "Apr", revenue: 35600, enrollments: 1180 },
  { month: "May", revenue: 41200, enrollments: 1390 },
  { month: "Jun", revenue: 47030, enrollments: 1620 },
];

export const enrollmentFunnel = [
  { stage: "Visited course", value: 24800 },
  { stage: "Added to cart", value: 9120 },
  { stage: "Started checkout", value: 6240 },
  { stage: "Purchased", value: 4310 },
  { stage: "Started learning", value: 3870 },
  { stage: "Completed", value: 2640 },
];

export const revenueByRegion = [
  { region: "North America", value: 112000 },
  { region: "Europe", value: 74000 },
  { region: "Asia", value: 38000 },
  { region: "South America", value: 16930 },
  { region: "Africa", value: 8000 },
];

export const topCourses = [
  { title: "Product Design Essentials", students: 62100, revenue: 521800, rating: 4.9 },
  { title: "Machine Learning Foundations", students: 49800, revenue: 498000, rating: 4.6 },
  { title: "Modern React Masterclass", students: 58420, revenue: 384210, rating: 4.8 },
  { title: "Python for Everybody", students: 98200, revenue: 312000, rating: 4.8 },
  { title: "TypeScript Deep Dive", students: 41200, revenue: 214900, rating: 4.7 },
];

export const couponPerformance = [
  { code: "LAUNCH40", redemptions: 2841, revenue: 86400, discount: 57600 },
  { code: "WELCOME10", redemptions: 18402, revenue: 742000, discount: 184020 },
  { code: "REACT25", redemptions: 412, revenue: 22300, discount: 7400 },
  { code: "FREEPYTHON", redemptions: 156, revenue: 0, discount: 7800 },
];

export const recentActivity = [
  { who: "Rahul Verma", action: "completed", target: "Python for Everybody", when: "2m ago" },
  { who: "Daniel Tran", action: "purchased", target: "Modern React Masterclass", when: "18m ago" },
  { who: "Bianca Rossi", action: "flagged at-risk in", target: "Machine Learning Foundations", when: "1h ago" },
  { who: "Emma Schmidt", action: "left a review on", target: "AWS for Developers", when: "3h ago" },
  { who: "Kwame Mensah", action: "started", target: "Growth Marketing for Founders", when: "5h ago" },
];

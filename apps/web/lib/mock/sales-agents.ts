import type { SalesAgent, SalesAgentApplication, SalesAgentReferral } from "@/types";

export const DEMO_AGENT_ID = "agent_james";

export const salesAgents: SalesAgent[] = [
  {
    id: "agent_james",
    name: "James Whitfield",
    email: "james@skillstream.dev",
    avatar: "",
    phone: "+1 (555) 301-4482",
    region: "North America",
    referralCode: "JAMES20",
    commissionPercent: 12,
    status: "approved",
    joinedAt: "2025-09-15T10:00:00Z",
    totalEarnings: 3840,
    pendingEarnings: 620,
    paidEarnings: 3220,
    referralCount: 47,
  },
  {
    id: "agent_priya",
    name: "Priya Ramachandran",
    email: "priya@skillstream.dev",
    avatar: "",
    phone: "+44 7700 900432",
    region: "Europe & UK",
    referralCode: "PRIYA15",
    commissionPercent: 10,
    status: "approved",
    joinedAt: "2025-11-01T08:30:00Z",
    totalEarnings: 2105,
    pendingEarnings: 440,
    paidEarnings: 1665,
    referralCount: 31,
  },
  {
    id: "agent_tariq",
    name: "Tariq Hassan",
    email: "tariq@skillstream.dev",
    avatar: "",
    phone: "+971 50 123 4567",
    region: "MENA",
    referralCode: "TARIQ18",
    commissionPercent: 15,
    status: "approved",
    joinedAt: "2026-01-20T09:00:00Z",
    totalEarnings: 960,
    pendingEarnings: 310,
    paidEarnings: 650,
    referralCount: 14,
  },
  {
    id: "agent_elena",
    name: "Elena Petrova",
    email: "elena@skillstream.dev",
    avatar: "",
    region: "Eastern Europe",
    referralCode: "ELENA12",
    commissionPercent: 10,
    status: "suspended",
    joinedAt: "2025-10-05T11:00:00Z",
    totalEarnings: 480,
    pendingEarnings: 0,
    paidEarnings: 480,
    referralCount: 9,
  },
];

export const pendingAgentApplications: SalesAgentApplication[] = [
  {
    id: "agapp_001",
    name: "Carlos Mendez",
    email: "carlos.mendez@salesmail.com",
    phone: "+52 55 1234 5678",
    region: "Latin America",
    bio: "10 years in EdTech distribution across Mexico and LATAM. Previously partnered with Coursera and Platzi. Fluent in Spanish and English.",
    appliedAt: "2026-06-20T14:00:00Z",
    status: "pending",
  },
  {
    id: "agapp_002",
    name: "Aisha Nkemelu",
    email: "aisha.nkemelu@example.com",
    phone: "+234 803 456 7890",
    region: "Sub-Saharan Africa",
    bio: "Corporate training consultant with strong relationships across Nigerian and Ghanaian enterprise accounts. Experienced in bulk course licensing deals.",
    appliedAt: "2026-06-22T09:45:00Z",
    status: "pending",
  },
];

export const agentReferrals: SalesAgentReferral[] = [
  // James's referrals
  { id: "ref_001", agentId: "agent_james", orderId: "ord_j1", studentName: "Mark Sullivan", courseTitle: "React 18 Mastery", orderTotal: 129, commissionEarned: 15.48, status: "paid", date: "2026-05-10T12:00:00Z" },
  { id: "ref_002", agentId: "agent_james", orderId: "ord_j2", studentName: "Sandra Gomez", courseTitle: "TypeScript Deep Dive", orderTotal: 99, commissionEarned: 11.88, status: "paid", date: "2026-05-15T09:30:00Z" },
  { id: "ref_003", agentId: "agent_james", orderId: "ord_j3", studentName: "Brian Torres", courseTitle: "Machine Learning A–Z", orderTotal: 149, commissionEarned: 17.88, status: "paid", date: "2026-05-22T15:00:00Z" },
  { id: "ref_004", agentId: "agent_james", orderId: "ord_j4", studentName: "Nina Patel", courseTitle: "AWS Solutions Architect", orderTotal: 179, commissionEarned: 21.48, status: "confirmed", date: "2026-06-01T11:00:00Z" },
  { id: "ref_005", agentId: "agent_james", orderId: "ord_j5", studentName: "Lucas Brown", courseTitle: "UI/UX Design Fundamentals", orderTotal: 89, commissionEarned: 10.68, status: "confirmed", date: "2026-06-08T14:00:00Z" },
  { id: "ref_006", agentId: "agent_james", orderId: "ord_j6", studentName: "Fatima Zahra", courseTitle: "Python for Data Science", orderTotal: 129, commissionEarned: 15.48, status: "pending", date: "2026-06-20T10:00:00Z" },
  { id: "ref_007", agentId: "agent_james", orderId: "ord_j7", studentName: "Daniel Kim", courseTitle: "React 18 Mastery", orderTotal: 129, commissionEarned: 15.48, status: "pending", date: "2026-06-23T16:00:00Z" },

  // Priya's referrals
  { id: "ref_008", agentId: "agent_priya", orderId: "ord_p1", studentName: "Thomas Müller", courseTitle: "TypeScript Deep Dive", orderTotal: 99, commissionEarned: 9.9, status: "paid", date: "2026-05-05T10:00:00Z" },
  { id: "ref_009", agentId: "agent_priya", orderId: "ord_p2", studentName: "Sophie Laurent", courseTitle: "Machine Learning A–Z", orderTotal: 149, commissionEarned: 14.9, status: "paid", date: "2026-05-18T14:00:00Z" },
  { id: "ref_010", agentId: "agent_priya", orderId: "ord_p3", studentName: "Alex Johansson", courseTitle: "AWS Solutions Architect", orderTotal: 179, commissionEarned: 17.9, status: "confirmed", date: "2026-06-10T09:00:00Z" },
  { id: "ref_011", agentId: "agent_priya", orderId: "ord_p4", studentName: "Emma Clarke", courseTitle: "Growth Marketing", orderTotal: 109, commissionEarned: 10.9, status: "pending", date: "2026-06-21T11:30:00Z" },

  // Tariq's referrals
  { id: "ref_012", agentId: "agent_tariq", orderId: "ord_t1", studentName: "Ahmed Al-Rashidi", courseTitle: "React 18 Mastery", orderTotal: 129, commissionEarned: 19.35, status: "paid", date: "2026-04-10T12:00:00Z" },
  { id: "ref_013", agentId: "agent_tariq", orderId: "ord_t2", studentName: "Nour Khalil", courseTitle: "Python for Data Science", orderTotal: 129, commissionEarned: 19.35, status: "confirmed", date: "2026-06-12T09:00:00Z" },
  { id: "ref_014", agentId: "agent_tariq", orderId: "ord_t3", studentName: "Omar Bin Yusuf", courseTitle: "Machine Learning A–Z", orderTotal: 149, commissionEarned: 22.35, status: "pending", date: "2026-06-22T14:00:00Z" },
];

export function getAgentById(id: string): SalesAgent | undefined {
  return salesAgents.find((a) => a.id === id);
}

export function getReferralsForAgent(agentId: string): SalesAgentReferral[] {
  return agentReferrals.filter((r) => r.agentId === agentId);
}

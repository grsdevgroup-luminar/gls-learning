import type { Organization, OrgInvitation } from "@/types";

export const DEMO_ORG_SLUG = "techcorp";

// Private courses assigned to orgs (reference existing course IDs from the mock catalog)
const TECHCORP_COURSES = ["c_react", "c_ts", "c_aws"];
const ACADEX_COURSES = ["c_python", "c_ml", "c_design"];

export const organizations: Organization[] = [
  {
    id: "org_techcorp",
    slug: "techcorp",
    name: "TechCorp Inc.",
    domain: "techcorp.io",
    logoUrl: undefined,
    adminEmail: "admin@techcorp.io",
    status: "active",
    seatCount: 20,
    usedSeats: 12,
    privateCourseIds: TECHCORP_COURSES,
    createdAt: "2026-01-10T09:00:00Z",
    members: [
      { id: "om_tc_01", orgId: "org_techcorp", name: "Rachel Turner", email: "rachel.turner@techcorp.io", avatar: "", role: "admin", joinedAt: "2026-01-10T09:00:00Z", enrolledCourseIds: ["c_react", "c_ts"] },
      { id: "om_tc_02", orgId: "org_techcorp", name: "Devon Walsh", email: "devon.walsh@techcorp.io", avatar: "", role: "member", joinedAt: "2026-01-15T10:00:00Z", enrolledCourseIds: ["c_react"] },
      { id: "om_tc_03", orgId: "org_techcorp", name: "Sofia Reyes", email: "sofia.reyes@techcorp.io", avatar: "", role: "member", joinedAt: "2026-02-01T08:30:00Z", enrolledCourseIds: ["c_ts", "c_aws"] },
      { id: "om_tc_04", orgId: "org_techcorp", name: "Ben Nakamura", email: "ben.nakamura@techcorp.io", avatar: "", role: "member", joinedAt: "2026-02-12T11:00:00Z", enrolledCourseIds: ["c_aws"] },
      { id: "om_tc_05", orgId: "org_techcorp", name: "Alicia Fox", email: "alicia.fox@techcorp.io", avatar: "", role: "member", joinedAt: "2026-03-05T14:00:00Z", enrolledCourseIds: [] },
      { id: "om_tc_06", orgId: "org_techcorp", name: "Marcus Cole", email: "marcus.cole@techcorp.io", avatar: "", role: "member", joinedAt: "2026-03-18T09:30:00Z", enrolledCourseIds: ["c_react"] },
      { id: "om_tc_07", orgId: "org_techcorp", name: "Tanya Singh", email: "tanya.singh@techcorp.io", avatar: "", role: "member", joinedAt: "2026-04-02T10:00:00Z", enrolledCourseIds: ["c_react", "c_aws"] },
      { id: "om_tc_08", orgId: "org_techcorp", name: "Omar Diaz", email: "omar.diaz@techcorp.io", avatar: "", role: "member", joinedAt: "2026-04-20T13:00:00Z", enrolledCourseIds: [] },
      { id: "om_tc_09", orgId: "org_techcorp", name: "Chloe Park", email: "chloe.park@techcorp.io", avatar: "", role: "member", joinedAt: "2026-05-05T08:00:00Z", enrolledCourseIds: ["c_ts"] },
      { id: "om_tc_10", orgId: "org_techcorp", name: "Ethan Brooks", email: "ethan.brooks@techcorp.io", avatar: "", role: "member", joinedAt: "2026-05-14T15:00:00Z", enrolledCourseIds: [] },
      { id: "om_tc_11", orgId: "org_techcorp", name: "Leila Hassan", email: "leila.hassan@techcorp.io", avatar: "", role: "member", joinedAt: "2026-06-01T09:00:00Z", enrolledCourseIds: [] },
      { id: "om_tc_12", orgId: "org_techcorp", name: "Ryan Carter", email: "ryan.carter@techcorp.io", avatar: "", role: "member", joinedAt: "2026-06-10T11:30:00Z", enrolledCourseIds: [] },
    ],
  },
  {
    id: "org_acadex",
    slug: "acadex",
    name: "Acadex University",
    domain: "acadex.edu",
    logoUrl: undefined,
    adminEmail: "lms@acadex.edu",
    status: "trial",
    seatCount: 50,
    usedSeats: 7,
    privateCourseIds: ACADEX_COURSES,
    createdAt: "2026-05-20T10:00:00Z",
    members: [
      { id: "om_ax_01", orgId: "org_acadex", name: "Professor Jean Moreau", email: "j.moreau@acadex.edu", avatar: "", role: "admin", joinedAt: "2026-05-20T10:00:00Z", enrolledCourseIds: ["c_python", "c_ml"] },
      { id: "om_ax_02", orgId: "org_acadex", name: "Kwame Asante", email: "k.asante@acadex.edu", avatar: "", role: "member", joinedAt: "2026-05-22T09:00:00Z", enrolledCourseIds: ["c_python"] },
      { id: "om_ax_03", orgId: "org_acadex", name: "Isabella Costa", email: "i.costa@acadex.edu", avatar: "", role: "member", joinedAt: "2026-05-25T14:00:00Z", enrolledCourseIds: ["c_design"] },
      { id: "om_ax_04", orgId: "org_acadex", name: "Yusuf Arslan", email: "y.arslan@acadex.edu", avatar: "", role: "member", joinedAt: "2026-06-02T11:00:00Z", enrolledCourseIds: [] },
      { id: "om_ax_05", orgId: "org_acadex", name: "Marie Dupont", email: "m.dupont@acadex.edu", avatar: "", role: "member", joinedAt: "2026-06-05T10:30:00Z", enrolledCourseIds: ["c_python"] },
      { id: "om_ax_06", orgId: "org_acadex", name: "James Okafor", email: "j.okafor@acadex.edu", avatar: "", role: "member", joinedAt: "2026-06-10T09:00:00Z", enrolledCourseIds: [] },
      { id: "om_ax_07", orgId: "org_acadex", name: "Layla Mansouri", email: "l.mansouri@acadex.edu", avatar: "", role: "member", joinedAt: "2026-06-15T13:00:00Z", enrolledCourseIds: [] },
    ],
  },
];

export const pendingInvitations: OrgInvitation[] = [
  {
    id: "inv_tc_01",
    orgId: "org_techcorp",
    email: "new.hire@techcorp.io",
    role: "member",
    token: "tok_abc123",
    expiresAt: "2026-07-10T00:00:00Z",
  },
  {
    id: "inv_tc_02",
    orgId: "org_techcorp",
    email: "contractor@external.com",
    role: "member",
    token: "tok_def456",
    expiresAt: "2026-07-05T00:00:00Z",
  },
];

export function getOrgBySlug(slug: string): Organization | undefined {
  return organizations.find((o) => o.slug === slug);
}

export function getOrgById(id: string): Organization | undefined {
  return organizations.find((o) => o.id === id);
}

import type { Instructor } from "@/types";

export const instructors: Instructor[] = [
  {
    id: "ins_sara",
    name: "Sara Lindqvist",
    title: "Principal Frontend Engineer",
    avatar: "",
    bio: "Ex-Vercel engineer with 12 years building design systems and large-scale React apps. Taught 180k+ students worldwide.",
    rating: 4.8,
    students: 184320,
    courses: 6,
  },
  {
    id: "ins_marcus",
    name: "Marcus Bennett",
    title: "Data Scientist & ML Lead",
    avatar: "",
    bio: "Led ML teams at two unicorns. Specializes in making statistics and deep learning approachable for working engineers.",
    rating: 4.7,
    students: 121870,
    courses: 5,
  },
  {
    id: "ins_amina",
    name: "Amina Yusuf",
    title: "Product Designer",
    avatar: "",
    bio: "Award-winning product designer. Helps engineers and founders design interfaces people love to use.",
    rating: 4.9,
    students: 96540,
    courses: 4,
  },
  {
    id: "ins_diego",
    name: "Diego Fernández",
    title: "Cloud & DevOps Architect",
    avatar: "",
    bio: "AWS-certified architect. Turns intimidating infrastructure topics into clear, hands-on lessons.",
    rating: 4.6,
    students: 78210,
    courses: 5,
  },
  {
    id: "ins_priya",
    name: "Priya Nair",
    title: "Growth Marketing Strategist",
    avatar: "",
    bio: "Scaled marketing for 3 SaaS companies past $10M ARR. Teaches marketing that engineers actually respect.",
    rating: 4.7,
    students: 64200,
    courses: 3,
  },
];

export function getInstructor(id: string) {
  return instructors.find((i) => i.id === id);
}

import type { Metadata } from "next";
import InstructorProfileClient from "./page-client";

export const metadata: Metadata = { title: "Instructor profile" };

export default function InstructorProfilePage() {
  return <InstructorProfileClient />;
}

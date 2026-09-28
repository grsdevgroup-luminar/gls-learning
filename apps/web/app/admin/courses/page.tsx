import type { Metadata } from "next";
import { Suspense } from "react";
import CoursesClient from "./page-client";

export const metadata: Metadata = { title: "Courses" };

export default function CoursesPage() {
  return (
    <Suspense>
      <CoursesClient />
    </Suspense>
  );
}

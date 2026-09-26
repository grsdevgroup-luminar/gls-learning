import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { InstructorPublicProfileDto } from "@skillstream/shared";
import { serverApiCachedOptional } from "@/lib/api/server";
import { InstructorHero } from "./_components/instructor-hero";
import { InstructorCourses } from "./_components/instructor-courses";

// Instructor profiles include user-controlled avatars. Read them fresh so
// an upload is visible immediately in the admin/public profile view.
export const revalidate = 0;

async function fetchInstructor(id: string) {
  return serverApiCachedOptional<InstructorPublicProfileDto>(`/instructors/${id}`, revalidate);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const instructor = await fetchInstructor(id);
  if (!instructor) return { title: "Instructor not found | GRS Learning" };

  return {
    title: `${instructor.name} | GRS Learning`,
    description: instructor.title || instructor.bio,
  };
}

export default async function InstructorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const instructor = await fetchInstructor(id);
  if (!instructor) notFound();

  return (
    <>
      <InstructorHero instructor={instructor} />
      <InstructorCourses instructorId={instructor.id} />
    </>
  );
}

import { LearnLoader } from "@/components/student/learn-loader";

export const dynamic = "force-dynamic";

export default async function LearnPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <LearnLoader slug={slug} />;
}

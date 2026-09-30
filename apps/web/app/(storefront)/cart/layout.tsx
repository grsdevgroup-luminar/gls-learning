import type { AuthUserDto } from "@grslearning/shared";
import { redirect } from "next/navigation";
import { serverApiOptional } from "@/lib/api/server";
import { u } from "framer-motion/client";

export default async function CommerceLayout({ children }: { children: React.ReactNode }) {
  const user = await serverApiOptional<AuthUserDto>("/auth/me");
  if (user?.role === "ORG_ADMIN") redirect("/org");
  if (user?.role === "DELIVERY_PARTNER") redirect("/delivery-partner");
  if (user?.role === "INSTRUCTOR") redirect("/instructor");
  return children;
}
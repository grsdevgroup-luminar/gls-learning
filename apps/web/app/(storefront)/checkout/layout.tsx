import type { AuthUserDto } from "@skillstream/shared";
import { redirect } from "next/navigation";
import { serverApiOptional } from "@/lib/api/server";

export default async function CommerceLayout({ children }: { children: React.ReactNode }) {
  const user = await serverApiOptional<AuthUserDto>("/auth/me");
  if (user?.role === "ORG_ADMIN") redirect("/org");
  if (user?.role === "DELIVERY_PARTNER") redirect("/delivery-partner");
  if (user?.role === "INSTRUCTOR") redirect("/instructor");
  if (user?.instructorStatus === "PENDING") redirect("/instructor");
  if (user?.deliveryPartnerStatus === "PENDING") redirect("/delivery-partner");
  return children;
}

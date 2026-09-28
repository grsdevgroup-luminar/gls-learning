import type { Metadata } from "next";
import { Suspense } from "react";
import DashboardClient from "./dashboard-client";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardClient />
    </Suspense>
  );
}

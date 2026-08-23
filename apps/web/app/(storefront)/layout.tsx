import type { Metadata } from "next";
import { SaleBanner } from "@/components/layout/sale-banner";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "GRS Learning — Learn anything, anywhere",
};

export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <SaleBanner />
      <Suspense fallback={<div className="sticky top-0 z-40 h-16 border-b bg-background/80" />}>
        <SiteHeader />
      </Suspense>
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

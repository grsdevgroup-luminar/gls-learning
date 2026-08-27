"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const BRAND = "GRS Learning";
const DEFAULT_TITLE = "GRS Learning — Learn anything, anywhere";

export function setPageTitle(title: string) {
  if (typeof document !== "undefined") {
    document.title = title === DEFAULT_TITLE ? title : `${title} | ${BRAND}`;
  }
}

/**
 * Returns a human-readable title for routes that otherwise inherit their
 * module layout title. Dynamic course detail pages are intentionally omitted:
 * their server metadata uses the actual course title.
 */
export function pageTitleForPathname(pathname: string): string | undefined {
  if (pathname === "/") return DEFAULT_TITLE;

  const titles: Array<[RegExp, string]> = [
    [/^\/checkout\/success$/, "Order confirmed"],
    [/^\/checkout$/, "Checkout"],
    [/^\/cart$/, "Shopping cart"],
    [/^\/courses$/, "Explore courses"],
    [/^\/teach$/, "Teach on GRS Learning"],
    [/^\/login$/, "Log in"],
    [/^\/signup$/, "Create account"],
    [/^\/forgot-password$/, "Reset password"],
    [/^\/reset-password$/, "Choose a new password"],
    [/^\/verify\/[^/]+$/, "Certificate verification"],
    [/^\/learn\/[^/]+$/, "Course learning"],
    [/^\/join\/[^/]+$/, "Join organization"],
    [/^\/certificates\/[^/]+\/print$/, "Certificate"],

    [/^\/dashboard\/progress$/, "My progress"],
    [/^\/dashboard\/team$/, "Team courses"],
    [/^\/dashboard\/certificates$/, "Certificates"],
    [/^\/dashboard\/billing$/, "Billing"],
    [/^\/dashboard$/, "Dashboard"],
    [/^\/account$/, "Account"],

    [/^\/admin\/courses\/new$/, "Create course"],
    [/^\/admin\/courses\/[^/]+\/edit$/, "Edit course"],
    [/^\/admin\/courses$/, "Courses"],
    [/^\/admin\/instructors$/, "Instructors"],
    [/^\/admin\/agents$/, "Sales agents"],
    [/^\/admin\/payouts$/, "Payouts"],
    [/^\/admin\/organizations$/, "Organizations"],
    [/^\/admin\/students$/, "Students"],
    [/^\/admin\/orders$/, "Orders"],
    [/^\/admin\/coupons$/, "Coupons"],
    [/^\/admin\/pricing$/, "Pricing"],
    [/^\/admin\/reviews$/, "Reviews"],
    [/^\/admin\/marketing$/, "Automation"],
    [/^\/admin\/settings$/, "Settings"],
    [/^\/admin$/, "Admin dashboard"],

    [/^\/instructor\/courses\/new$/, "Create course"],
    [/^\/instructor\/courses\/[^/]+\/edit$/, "Edit course"],
    [/^\/instructor\/courses$/, "My courses"],
    [/^\/instructor\/earnings$/, "Earnings"],
    [/^\/instructor\/profile$/, "Instructor profile"],
    [/^\/instructor$/, "Instructor dashboard"],

    [/^\/sales-agent\/referrals$/, "Referrals"],
    [/^\/sales-agent\/earnings$/, "Earnings"],
    [/^\/sales-agent\/profile$/, "Sales agent profile"],
    [/^\/sales-agent$/, "Sales agent dashboard"],

    [/^\/org\/[^/]+\/courses$/, "Organization courses"],
    [/^\/org\/[^/]+\/members$/, "Organization members"],
    [/^\/org\/[^/]+\/account$/, "Organization account"],
    [/^\/org\/[^/]+$/, "Organization dashboard"],
    [/^\/org$/, "Organization portal"],
  ];

  return titles.find(([pattern]) => pattern.test(pathname))?.[1];
}

export function PageTitle() {
  const pathname = usePathname();

  useEffect(() => {
    const title = pageTitleForPathname(pathname);
    if (!title) return;

    setPageTitle(title);
    const expectedTitle = title === DEFAULT_TITLE ? title : `${title} | ${BRAND}`;

    // Next can replace the title element after this effect during navigation.
    // Keep the route-specific title when that head refresh completes.
    const observer = new MutationObserver(() => {
      if (document.title !== expectedTitle) setPageTitle(title);
    });
    observer.observe(document.head, { childList: true, subtree: true });

    const timer = window.setTimeout(() => setPageTitle(title), 0);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [pathname]);

  return null;
}

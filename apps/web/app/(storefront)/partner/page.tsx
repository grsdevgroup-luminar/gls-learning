"use client";

import Link from "next/link";
import { useStore } from "@/lib/context/store";
import { useSession } from "@/lib/api/session";
import { useMyPartnerApplication } from "@/lib/api/delivery-partner-hooks";
import { Section } from "@/components/shared/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Clock, Handshake, Mail, XCircle } from "lucide-react";
import { PartnerHero } from "./_components/partner-hero";
import { PartnerSignupForm } from "./_components/partner-signup-form";

function StatusCard({
  tile, icon: Icon, title, body, action,
}: {
  tile: string;
  icon: typeof Clock;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <Card variant="elevated" className="items-center py-12 text-center">
      <CardContent className="flex flex-col items-center gap-3">
        <span className="icon-tile grid size-12 place-items-center" style={{ ["--tile" as string]: tile }}>
          <Icon className="size-6" />
        </span>
        <p className="font-heading text-lg font-semibold">{title}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{body}</p>
        {action}
      </CardContent>
    </Card>
  );
}

/**
 * Applying is only ever the combined signup+apply step on this page (see
 * DELIVERY_PARTNER_MEMBER_FLOW_PLAN.md §2) — a brand-new visitor is the only
 * one who ever sees a form here. Everyone else who lands on this page while
 * logged in (pending, rejected, approved, or just a plain student who never
 * applied) sees a read-only status message instead.
 */
export default function PartnerPage() {
  const { role, mounted } = useStore();
  const { user } = useSession();
  const alreadyPartner = mounted && role === "delivery_partner";
  const { data: application } = useMyPartnerApplication(!!user && !alreadyPartner);

  function body() {
    if (alreadyPartner) {
      return (
        <StatusCard
          tile="var(--tint-emerald)"
          icon={Handshake}
          title="You're already a delivery partner"
          body="Head to your dashboard to grab your referral link and track commissions."
          action={<Button render={<Link href="/delivery-partner" />}>Go to dashboard <ArrowRight /></Button>}
        />
      );
    }

    if (user && application?.status === "PENDING") {
      return (
        <StatusCard
          tile="var(--tint-amber)"
          icon={Clock}
          title="Your application is under review"
          body="We'll email you a decision within 1–2 business days."
        />
      );
    }

    if (user && application?.status === "REJECTED") {
      return (
        <StatusCard
          tile="var(--tint-rose)"
          icon={XCircle}
          title="Your application wasn't approved"
          body={application.note ?? "Your delivery partner application wasn't approved this time."}
          action={
            <Button variant="outline" render={<a href="mailto:support@grslearning.dev" />}>
              <Mail /> Contact support
            </Button>
          }
        />
      );
    }

    // A plain student (or any other existing account) who never applied —
    // no form here; the only way in is the signup+apply journey below,
    // which only a signed-out visitor sees.
    if (user) {
      return (
        <StatusCard
          tile="var(--tint-indigo)"
          icon={Handshake}
          title="This program is for new sign-ups"
          body="Delivery partner applications are only available when creating a new account. Log out to apply with a different email, or contact support if you believe this is a mistake."
          action={
            <Button variant="outline" render={<a href="mailto:support@grslearning.dev" />}>
              <Mail /> Contact support
            </Button>
          }
        />
      );
    }

    return <PartnerSignupForm />;
  }

  return (
    <>
      <PartnerHero />
      <Section size="sm" className="pb-24">
        <div className="mx-auto max-w-2xl">{body()}</div>
      </Section>
    </>
  );
}

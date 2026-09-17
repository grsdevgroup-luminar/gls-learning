"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useStore } from "@/lib/context/store";
import { useSession } from "@/lib/api/session";
import { useMyPartnerApplication } from "@/lib/api/delivery-partner-hooks";
import { PartnerDocumentUploader } from "@/components/shared/partner-document-uploader";
import { Section } from "@/components/shared/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Clock, Handshake, XCircle } from "lucide-react";
import { PartnerHero } from "./_components/partner-hero";
import { ApplyPartnerForm } from "./_components/apply-partner-form";
import { PartnerSignupForm } from "./_components/partner-signup-form";

function StatusCard({
  tile, icon: Icon, title, body,
}: {
  tile: string;
  icon: typeof Clock;
  title: string;
  body: string;
}) {
  return (
    <Card variant="elevated" className="items-center py-12 text-center">
      <CardContent className="flex flex-col items-center gap-3">
        <span className="icon-tile grid size-12 place-items-center" style={{ ["--tile" as string]: tile }}>
          <Icon className="size-6" />
        </span>
        <p className="font-heading text-lg font-semibold">{title}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}

export default function PartnerPage() {
  const qc = useQueryClient();
  const { role, mounted } = useStore();
  const { user } = useSession();
  const alreadyPartner = mounted && role === "delivery_partner";
  const { data: application } = useMyPartnerApplication(!!user && !alreadyPartner);

  function body() {
    if (alreadyPartner) {
      return (
        <Card variant="elevated" className="items-center py-12 text-center">
          <CardContent className="flex flex-col items-center gap-3">
            <span className="icon-tile grid size-12 place-items-center" style={{ ["--tile" as string]: "var(--tint-emerald)" }}>
              <Handshake className="size-6" />
            </span>
            <p className="font-heading text-lg font-semibold">You&apos;re already a delivery partner</p>
            <p className="max-w-sm text-sm text-muted-foreground">Head to your dashboard to grab your referral link and track commissions.</p>
            <Button render={<Link href="/delivery-partner" />}>Go to dashboard <ArrowRight /></Button>
          </CardContent>
        </Card>
      );
    }

    if (user && application?.status === "PENDING") {
      return (
        <div className="space-y-6">
          <StatusCard
            tile="var(--tint-amber)"
            icon={Clock}
            title="Your application is under review"
            body="We'll email you a decision within 1–2 business days. You can attach supporting documents below while you wait."
          />
          <Card variant="elevated">
            <CardHeader>
              <CardTitle className="text-base">Supporting documents (optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <PartnerDocumentUploader
                documents={application.documents}
                onChange={() =>
                  qc.invalidateQueries({ queryKey: ["me", "delivery-partner", "application"] })
                }
              />
            </CardContent>
          </Card>
        </div>
      );
    }

    if (user && application?.status === "REJECTED") {
      return (
        <div className="space-y-6">
          <StatusCard
            tile="var(--tint-rose)"
            icon={XCircle}
            title="Your previous application wasn't approved"
            body={application.note ?? "You're welcome to apply again below."}
          />
          <ApplyPartnerForm />
        </div>
      );
    }

    if (user) return <ApplyPartnerForm />;
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

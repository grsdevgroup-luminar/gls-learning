"use client";

import Link from "next/link";
import type { DeliveryPartnerDto } from "@skillstream/shared";
import { useMyDeliveryPartner, useMyPartnerReferrals, referralLinkFor } from "@/lib/api/delivery-partner-hooks";
import { formatUsd, relativeDate } from "@/lib/format";
import { StatStrip, Stat } from "@/components/shared/stat-strip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DollarSign, Link2, TrendingUp, Copy, CheckCircle2, Clock, Wallet, Loader2,
  XCircle, PauseCircle, Handshake, Mail,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const statusBadge = {
  paid:      { label: "Paid",      cls: "text-success" },
  confirmed: { label: "Confirmed", cls: "text-primary" },
  pending:   { label: "Pending",   cls: "text-warning" },
} as const;

/** Explanatory state for every non-APPROVED partner status. */
function PartnerBlocked({
  status,
}: {
  status: Exclude<DeliveryPartnerDto["status"], "APPROVED">;
}) {
  const copy = {
    PENDING: {
      icon: Clock,
      cls: "text-warning",
      title: "Application under review",
      body: "We review new delivery partner applications within 1–2 business days. Your referral tools unlock on approval.",
      action: (
        <Button render={<Link href="/partner" />} variant="outline" className="mt-5">
          View application
        </Button>
      ),
    },
    // No self-service re-apply (see DELIVERY_PARTNER_MEMBER_FLOW_PLAN.md
    // §2.4) — a rejected applicant contacts support instead.
    REJECTED: {
      icon: XCircle,
      cls: "text-destructive",
      title: "Application not approved",
      body: "Your application wasn't approved this time. Contact support if you have questions.",
      action: (
        <Button render={<a href="mailto:support@grslearning.dev" />} variant="outline" className="mt-5">
          <Mail /> Contact support
        </Button>
      ),
    },
    SUSPENDED: {
      icon: PauseCircle,
      cls: "text-destructive",
      title: "Account suspended",
      body: "Your delivery partner account is suspended, so referral links and commission are paused. Contact support to resolve this.",
      action: (
        <Button render={<a href="mailto:support@grslearning.dev" />} variant="outline" className="mt-5">
          <Mail /> Contact support
        </Button>
      ),
    },
  }[status];

  const Icon = copy.icon;
  return (
    <div className="grid min-h-[60vh] place-items-center p-6 text-center">
      <div className="max-w-md">
        <Icon className={`mx-auto mb-4 h-10 w-10 ${copy.cls}`} />
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          {copy.title}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">{copy.body}</p>
        {copy.action}
      </div>
    </div>
  );
}

function NoApplication() {
  return (
    <div className="grid min-h-[60vh] place-items-center p-6 text-center">
      <div className="max-w-md">
        <Handshake className="mx-auto mb-4 h-10 w-10 text-primary" />
        <h1 className="font-heading text-2xl font-bold tracking-tight">You haven&apos;t applied yet</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Apply to become a delivery partner to unlock referral, earnings, and profile tools.
        </p>
        <Button render={<Link href="/partner" />} className="mt-5">
          Apply now
        </Button>
      </div>
    </div>
  );
}

export default function DeliveryPartnerOverview() {
  const { data: partner, isLoading } = useMyDeliveryPartner();
  const { data: referrals } = useMyPartnerReferrals();
  const [copied, setCopied] = useState(false);

  if (isLoading) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!partner) {
    return <NoApplication />;
  }

  // Only an APPROVED partner gets referral tools. Anything else gets an
  // explanatory state — a suspended partner must not keep earning links.
  if (partner.status !== "APPROVED") {
    return <PartnerBlocked status={partner.status} />;
  }

  const recent = (referrals ?? []).slice(0, 5);
  const referralLink = referralLinkFor(partner.referralCode);

  function copyLink() {
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      toast.success("Referral link copied!");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6 md:p-10">
      <header>
        <p className="text-sm font-medium text-muted-foreground">Delivery Partner</p>
        <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight">
          Welcome back, {partner.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Region: {partner.region} · Commission: {partner.commissionPercent}%
        </p>
      </header>

      <StatStrip className="grid-cols-2 lg:grid-cols-4">
        <Stat icon={DollarSign} label="Lifetime earnings" value={formatUsd(partner.totalEarningsCents / 100)} tint="var(--tint-emerald)" />
        <Stat icon={Clock} label="Pending" value={formatUsd(partner.pendingEarningsCents / 100)} tint="var(--tint-amber)" />
        <Stat icon={Wallet} label="Paid out" value={formatUsd(partner.paidEarningsCents / 100)} tint="var(--tint-indigo)" />
        <Stat icon={Link2} label="Total referrals" value={partner.referralCount} tint="var(--tint-sky)" />
      </StatStrip>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" />
            Your referral link
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Share this link to earn {partner.commissionPercent}% commission on every purchase made through it.
          </p>
          <div className="flex gap-2">
            <Input readOnly value={referralLink} className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={copyLink} aria-label="Copy link">
              {copied ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Or share your code directly: <span className="font-mono font-semibold text-foreground">{partner.referralCode}</span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent referrals</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No referrals yet. Share your link to get started.</p>
          ) : (
            <div className="divide-y">
              {recent.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <div className="font-medium">{r.studentName}</div>
                    <div className="text-xs text-muted-foreground">{r.courseTitle} · {relativeDate(r.createdAt)}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={statusBadge[r.status].cls}>
                      {statusBadge[r.status].label}
                    </Badge>
                    <span className="font-mono font-medium text-success">
                      +{formatUsd(r.commissionCents / 100)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

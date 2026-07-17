"use client";

import { useQueryClient } from "@tanstack/react-query";
import type { SalesAgentDto } from "@skillstream/shared";
import { useMySalesAgent, useMyAgentReferrals, referralLinkFor } from "@/lib/api/agent-hooks";
import { api } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useSession } from "@/lib/api/session";
import { formatUsd, relativeDate } from "@/lib/format";
import { StatStrip, Stat } from "@/components/shared/stat-strip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DollarSign, Link2, TrendingUp, Copy, CheckCircle2, Clock, Wallet, Loader2,
  XCircle, PauseCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const statusBadge = {
  paid:      { label: "Paid",      cls: "text-success" },
  confirmed: { label: "Confirmed", cls: "text-primary" },
  pending:   { label: "Pending",   cls: "text-warning" },
} as const;

/** Explanatory state for every non-APPROVED agent status (spec §7). */
function AgentBlocked({
  status,
}: {
  status: Exclude<SalesAgentDto["status"], "APPROVED">;
}) {
  const copy = {
    PENDING: {
      icon: Clock,
      cls: "text-warning",
      title: "Application under review",
      body: "We review new agent applications within 1–2 business days. Your referral tools unlock on approval.",
    },
    REJECTED: {
      icon: XCircle,
      cls: "text-destructive",
      title: "Application not approved",
      body: "Your application wasn't approved this time. If your circumstances have changed, contact support to ask for another review.",
    },
    SUSPENDED: {
      icon: PauseCircle,
      cls: "text-destructive",
      title: "Account suspended",
      body: "Your agent account is suspended, so referral links and commission are paused. Contact support to resolve this.",
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
      </div>
    </div>
  );
}

function AgentApplyForm() {
  const qc = useQueryClient();
  const { user } = useSession();
  const [region, setRegion] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!region.trim() || bio.trim().length < 20) {
      toast.error("Please add your region and a short pitch (at least 20 characters).");
      return;
    }
    setSubmitting(true);
    try {
      await api.applySalesAgent({
        name: user.name,
        email: user.email,
        phone: phone.trim() || undefined,
        region: region.trim(),
        bio: bio.trim(),
      });
      toast.success("Application submitted! 🎉", { description: "We'll review it within 1–2 business days." });
      void qc.invalidateQueries({ queryKey: ["me", "sales-agent"] });
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 p-6 md:p-10">
      <div className="text-center">
        <h1 className="font-heading text-2xl font-bold tracking-tight">Become a sales agent</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Refer students with your personal link and earn commission on every sale.
        </p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Region</Label>
                <Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="e.g. South Asia" />
              </div>
              <div className="space-y-1.5">
                <Label>Phone (optional)</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+880…" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Why you?</Label>
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Your audience, network, and how you plan to promote courses…"
                className="min-h-28"
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Submitting…" : "Apply now"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SalesAgentOverview() {
  const { data: agent, isLoading } = useMySalesAgent();
  const { data: referrals } = useMyAgentReferrals();
  const [copied, setCopied] = useState(false);

  if (isLoading) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!agent) {
    return <AgentApplyForm />;
  }

  // Only an APPROVED agent gets referral tools. Anything else gets an
  // explanatory state — a suspended agent must not keep earning links.
  if (agent.status !== "APPROVED") {
    return <AgentBlocked status={agent.status} />;
  }

  const recent = (referrals ?? []).slice(0, 5);
  const referralLink = referralLinkFor(agent.referralCode);

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
        <p className="text-sm font-medium text-muted-foreground">Sales Agent</p>
        <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight">
          Welcome back, {agent.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Region: {agent.region} · Commission: {agent.commissionPercent}%
        </p>
      </header>

      <StatStrip className="grid-cols-2 lg:grid-cols-4">
        <Stat icon={DollarSign} label="Lifetime earnings" value={formatUsd(agent.totalEarningsCents / 100)} tint="var(--tint-emerald)" />
        <Stat icon={Clock} label="Pending" value={formatUsd(agent.pendingEarningsCents / 100)} tint="var(--tint-amber)" />
        <Stat icon={Wallet} label="Paid out" value={formatUsd(agent.paidEarningsCents / 100)} tint="var(--tint-indigo)" />
        <Stat icon={Link2} label="Total referrals" value={agent.referralCount} tint="var(--tint-sky)" />
      </StatStrip>

      {/* Referral link */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" />
            Your referral link
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Share this link to earn {agent.commissionPercent}% commission on every purchase made through it.
          </p>
          <div className="flex gap-2">
            <Input readOnly value={referralLink} className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={copyLink} aria-label="Copy link">
              {copied ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Or share your code directly: <span className="font-mono font-semibold text-foreground">{agent.referralCode}</span>
          </p>
        </CardContent>
      </Card>

      {/* Recent referrals */}
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

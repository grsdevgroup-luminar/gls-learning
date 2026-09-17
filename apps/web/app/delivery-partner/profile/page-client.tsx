"use client";

import { useState } from "react";
import { useMyDeliveryPartner, referralLinkFor } from "@/lib/api/delivery-partner-hooks";
import { PartnerMissingState, PartnerPageLoading, PartnerStatusState } from "../_components/partner-page-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Copy, CheckCircle2, Link2, User } from "lucide-react";
import { toast } from "sonner";

export default function PartnerProfile() {
  const { data: partner, isLoading } = useMyDeliveryPartner();
  const [copied, setCopied] = useState(false);

  if (isLoading) return <PartnerPageLoading />;
  if (!partner) return <PartnerMissingState />;
  if (partner.status !== "APPROVED") return <PartnerStatusState status={partner.status} />;

  const referralLink = referralLinkFor(partner.referralCode);

  function copyLink() {
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      toast.success("Referral link copied!");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const statusColors: Record<string, string> = {
    APPROVED: "text-success",
    PENDING: "text-warning",
    REJECTED: "text-destructive",
    SUSPENDED: "text-muted-foreground",
  };
  const statusLabel = partner.status.charAt(0) + partner.status.slice(1).toLowerCase();

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">Your partner details and referral credentials.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" /> Partner information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-xl font-bold text-primary">
              {partner.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="font-semibold">{partner.name}</div>
              <div className="text-sm text-muted-foreground">{partner.email}</div>
              <Badge variant="outline" className={`mt-1 ${statusColors[partner.status] ?? ""}`}>
                {statusLabel}
              </Badge>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Region</div>
              <div className="font-medium">{partner.region}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Commission rate</div>
              <div className="font-medium text-success">{partner.commissionPercent}%</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Member since</div>
              <div className="font-medium">
                {new Date(partner.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-4 w-4" /> Referral credentials
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Referral code</Label>
            <div className="flex gap-2">
              <Input readOnly value={partner.referralCode} className="font-mono font-semibold" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(partner.referralCode);
                  toast.success("Code copied!");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Referral link</Label>
            <div className="flex gap-2">
              <Input readOnly value={referralLink} className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={copyLink} aria-label="Copy referral link">
                {copied ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Every purchase made through this link earns you {partner.commissionPercent}% commission.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

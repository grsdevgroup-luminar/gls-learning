import Link from "next/link";
import type { DeliveryPartnerDto } from "@skillstream/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, PauseCircle, UserPlus, XCircle } from "lucide-react";

export function PartnerPageLoading() {
  return (
    <div className="space-y-6 p-6 md:p-8">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}

export function PartnerMissingState() {
  return (
    <div className="grid min-h-[50vh] place-items-center p-6">
      <Card className="max-w-md text-center">
        <CardContent className="pt-6">
          <UserPlus className="mx-auto mb-4 h-10 w-10 text-primary" />
          <h1 className="font-heading text-xl font-bold tracking-tight">
            No delivery partner profile yet
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Apply first, then your referral, earnings, and profile tools will appear here after approval.
          </p>
          <Button render={<Link href="/delivery-partner" />} className="mt-5">
            Go to application
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function PartnerStatusState({
  status,
}: {
  status: Exclude<DeliveryPartnerDto["status"], "APPROVED">;
}) {
  const copy = {
    PENDING: {
      icon: Clock,
      cls: "text-warning",
      title: "Application under review",
      body: "Your referral, earnings, and profile pages unlock after admin approval.",
    },
    REJECTED: {
      icon: XCircle,
      cls: "text-destructive",
      title: "Application not approved",
      body: "Your delivery-partner tools are unavailable for this application status.",
    },
    SUSPENDED: {
      icon: PauseCircle,
      cls: "text-destructive",
      title: "Account suspended",
      body: "Referral tools and commission reporting are paused. Contact support to resolve this.",
    },
  }[status];
  const Icon = copy.icon;

  return (
    <div className="grid min-h-[50vh] place-items-center p-6 text-center">
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

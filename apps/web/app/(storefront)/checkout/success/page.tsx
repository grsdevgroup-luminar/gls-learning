"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/endpoints";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, ArrowRight, ReceiptText, PlayCircle, Loader2 } from "lucide-react";
import { formatUsd } from "@/lib/format";

function SuccessContent() {
  const qc = useQueryClient();
  const params = useSearchParams();
  const orderId = params.get("order");

  // Fresh enrollments so the dashboard reflects the purchase immediately.
  useEffect(() => {
    void qc.invalidateQueries({ queryKey: ["store", "enrollments"] });
    void qc.invalidateQueries({ queryKey: ["enrollments"] });
  }, [qc]);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders", "mine"],
    queryFn: () => api.myOrders(),
    enabled: !!orderId,
    // Stripe/PayPal webhooks may lag a moment behind the redirect.
    refetchInterval: (q) => {
      const found = q.state.data?.find((o) => o.id === orderId);
      return found?.status === "PAID" ? false : 2000;
    },
  });
  const order = orders?.find((o) => o.id === orderId);
  const pending = !!orderId && order?.status !== "PAID";

  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-full bg-success/15">
        {pending && isLoading ? (
          <Loader2 className="h-11 w-11 animate-spin text-success" />
        ) : (
          <CheckCircle2 className="h-11 w-11 text-success" />
        )}
      </div>
      <h1 className="text-3xl font-bold tracking-tight">
        {pending && isLoading ? "Confirming your payment…" : "You're enrolled! 🎉"}
      </h1>
      <p className="mt-3 text-muted-foreground">
        {pending && isLoading
          ? "Hang tight — we're finalizing your order."
          : "Your purchase is complete. Your courses are unlocked and ready."}
      </p>

      <Card className="mt-8 text-left">
        <CardContent className="space-y-3 pt-6 text-sm">
          {order && (
            <div className="flex items-center gap-3">
              <ReceiptText className="h-5 w-5 text-primary" />
              <span>
                Order <span className="font-mono text-xs">{order.id}</span> ·{" "}
                {order.items.length} course{order.items.length !== 1 && "s"} ·{" "}
                <span className="font-semibold">{formatUsd(order.totalCents / 100)}</span>{" "}
                <span className={order.status === "PAID" ? "text-success" : "text-warning"}>
                  ({order.status})
                </span>
              </span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <PlayCircle className="h-5 w-5 text-primary" />
            <span>Your courses are ready in your dashboard</span>
          </div>
        </CardContent>
      </Card>

      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Button size="lg" render={<Link href="/dashboard" />}>
          Go to my learning <ArrowRight />
        </Button>
        <Button size="lg" variant="outline" render={<Link href="/courses" />}>
          Keep browsing
        </Button>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-xl px-4 py-20" />}>
      <SuccessContent />
    </Suspense>
  );
}

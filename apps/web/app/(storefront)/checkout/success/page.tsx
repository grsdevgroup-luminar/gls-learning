"use client";

import Link from "next/link";
import { useStore } from "@/lib/context/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, ArrowRight, Mail, PlayCircle } from "lucide-react";

export default function SuccessPage() {
  const { login, role } = useStore();
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-full bg-success/15">
        <CheckCircle2 className="h-11 w-11 text-success" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight">You're enrolled! 🎉</h1>
      <p className="mt-3 text-muted-foreground">
        Your purchase is complete. A receipt and access details are on their way to your inbox.
      </p>

      <Card className="mt-8 text-left">
        <CardContent className="space-y-3 pt-6 text-sm">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-primary" />
            <span>Confirmation email & invoice sent (simulated)</span>
          </div>
          <div className="flex items-center gap-3">
            <PlayCircle className="h-5 w-5 text-primary" />
            <span>Your courses are ready in your dashboard</span>
          </div>
        </CardContent>
      </Card>

      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Button
          size="lg"
          onClick={() => { if (role === "guest") login(); }}
          render={<Link href="/dashboard" />}
        >
          Go to my learning <ArrowRight />
        </Button>
        <Button size="lg" variant="outline" render={<Link href="/courses" />}>
          Keep browsing
        </Button>
      </div>
    </div>
  );
}

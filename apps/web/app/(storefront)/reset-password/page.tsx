"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { authApi } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import { Logo } from "@/components/shared/logo";
import { Reveal, Stagger, Magnetic } from "@/components/shared/motion";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, KeyRound, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Invalid link</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This password reset link is missing or malformed.
          </p>
        </div>
        <Link href="/forgot-password" className="text-sm text-primary hover:underline">
          Request a new reset link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-success/10 text-success">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Password updated</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your password has been reset. You can now sign in with your new credentials.
          </p>
        </div>
        <Button className="sheen w-full" onClick={() => router.push("/login")}>
          Go to sign in
        </Button>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password too short", { description: "Minimum 8 characters required." });
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setIsPending(true);
    try {
      await authApi.resetPassword(token!, password);
      setDone(true);
    } catch (err) {
      const message = err instanceof ApiError ? err.displayMessage : "Reset failed";
      toast.error("Could not reset password", { description: message });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <div className="text-center">
        <h1 className="text-2xl font-bold">Set new password</h1>
        <p className="text-sm text-muted-foreground">Choose a strong password you haven&apos;t used before.</p>
      </div>

      <form onSubmit={(e) => void submit(e)}>
        <Stagger className="space-y-3" gap={0.06}>
          <FormField label="New password" htmlFor="password">
            <Input
              id="password"
              type="password"
              placeholder="At least 8 characters"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>
          <FormField label="Confirm password" htmlFor="confirm">
            <Input
              id="confirm"
              type="password"
              placeholder="Repeat your new password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </FormField>
        </Stagger>

        <Magnetic strength={0.15} className="mt-4 flex w-full">
          <Button
            type="submit"
            className="sheen w-full"
            size="lg"
            disabled={isPending}
          >
            <KeyRound className="h-4 w-4" />
            {isPending ? "Updating…" : "Update password"}
          </Button>
        </Magnetic>
      </form>
    </>
  );
}

function ResetPasswordPage() {
  return (
    <div className="relative mx-auto flex min-h-[80vh] max-w-md flex-col justify-center overflow-hidden px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-104 w-104 -translate-x-1/2 -translate-y-1/3 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--aurora-2)_32%,transparent),transparent)] opacity-0 blur-3xl dark:opacity-40"
      />
      <Reveal y={16}>
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
      </Reveal>

      <Reveal y={20} delay={0.06}>
        <Card className="border-border/80 shadow-xl shadow-primary/3 dark:shadow-black/20">
          <CardContent className="space-y-5 pt-6">
            <ResetPasswordForm />
            <Link
              href="/login"
              className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to sign in
            </Link>
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}

export default function ResetPasswordPageWrapper() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-4 py-16">Loading…</div>}>
      <ResetPasswordPage />
    </Suspense>
  );
}

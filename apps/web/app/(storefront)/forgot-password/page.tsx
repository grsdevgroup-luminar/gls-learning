"use client";

import Link from "next/link";
import { useState } from "react";
import { authApi } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import { Logo } from "@/components/shared/logo";
import { Reveal, Stagger, Magnetic } from "@/components/shared/motion";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Mail, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setIsPending(true);
    try {
      await authApi.forgotPassword(email);
      setSubmitted(true);
    } catch (err) {
      const message = err instanceof ApiError ? err.displayMessage : "Something went wrong";
      toast.error("Request failed", { description: message });
    } finally {
      setIsPending(false);
    }
  }

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
            {submitted ? (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <div className="grid h-14 w-14 place-items-center rounded-full bg-success/10 text-success">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Check your inbox</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    If <span className="font-medium text-foreground">{email}</span> is
                    registered, you&apos;ll receive a reset link within a few minutes.
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Didn&apos;t get the email? Check your spam folder or{" "}
                  <button
                    className="text-primary hover:underline"
                    onClick={() => setSubmitted(false)}
                  >
                    try again
                  </button>
                  .
                </p>
              </div>
            ) : (
              <>
                <div className="text-center">
                  <h1 className="text-2xl font-bold">Reset your password</h1>
                  <p className="text-sm text-muted-foreground">
                    Enter your email and we&apos;ll send you a reset link.
                  </p>
                </div>

                <form onSubmit={(e) => void submit(e)}>
                  <Stagger className="space-y-3" gap={0.06}>
                    <FormField label="Email" htmlFor="email">
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
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
                      <Mail className="h-4 w-4" />
                      {isPending ? "Sending…" : "Send reset link"}
                    </Button>
                  </Magnetic>
                </form>
              </>
            )}

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

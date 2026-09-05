"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/lib/api/auth";
import { SESSION_QUERY_KEY } from "@/lib/api/session";
import { ApiError } from "@/lib/api/errors";
import { passwordSchema } from "@skillstream/shared";
import { destinationFor } from "@/lib/auth/destination";
import { Logo } from "@/components/shared/logo";
import { Reveal, Stagger, Magnetic } from "@/components/shared/motion";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

function ForcePasswordChangeForm() {
  const queryClient = useQueryClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const result = passwordSchema.safeParse(password);
    if (!result.success) {
      toast.error("Invalid password", { description: result.error.issues[0]?.message });
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setIsPending(true);
    try {
      await authApi.forcePasswordChange(password);
      const me = await authApi.me();
      queryClient.setQueryData(SESSION_QUERY_KEY, me);
      toast.success("Password set", { description: "You're all set." });
      window.location.href = destinationFor(me);
    } catch (err) {
      const message = err instanceof ApiError ? err.displayMessage : "Could not set password";
      toast.error("Something went wrong", { description: message });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Set your password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            For your security, choose a new password before continuing.
          </p>
        </div>
      </div>

      <form onSubmit={(e) => void submit(e)} className="mt-5">
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
          <Button type="submit" className="sheen w-full" size="lg" disabled={isPending}>
            <KeyRound className="h-4 w-4" />
            {isPending ? "Setting password…" : "Set password and continue"}
          </Button>
        </Magnetic>
      </form>
    </>
  );
}

export default function ForcePasswordChangePage() {
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
            <ForcePasswordChangeForm />
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}

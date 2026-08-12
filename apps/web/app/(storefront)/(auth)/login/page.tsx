"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { authApi } from "@/lib/api/auth";
import { useLogin } from "@/lib/api/session";
import { ApiError } from "@/lib/api/errors";
import { Logo } from "@/components/shared/logo";
import { Reveal, Stagger, StaggerItem, Magnetic } from "@/components/shared/motion";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { toast } from "sonner";

function LoginForm() {
  const login = useLogin();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  function destinationFor(role: string): string {
    const next = params.get("next");
    // An explicit return path (e.g. an org-invite join link) always wins.
    if (next) return next;
    if (role === "ADMIN") return "/admin";
    if (role === "INSTRUCTOR") return "/instructor";
    if (role === "SALES_AGENT") return "/sales-agent";
    if (role === "ORG_ADMIN") return "/org";
    return next || "/dashboard";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await login.mutateAsync({ email, password });
      const me = await authApi.me();
      toast.success("Welcome back!", { description: `Signed in as ${me.name}` });
      // Hard navigation, not router.push: the destination route may already be
      // sitting in Next's client router cache from a pre-login prefetch (e.g. a
      // visible nav link to /admin or /dashboard), which would serve the stale
      // "redirect to /login" response instead of re-checking the fresh session.
      window.location.href = destinationFor(me.role);
    } catch (err) {
      const message = err instanceof ApiError ? err.displayMessage : "Login failed";
      toast.error("Could not sign in", { description: message });
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
            <div className="text-center">
              <h1 className="text-2xl font-bold">Welcome back</h1>
              <p className="text-sm text-muted-foreground">Sign in to continue learning</p>
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
                <FormField label="Password" htmlFor="password">
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Your password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-8 w-9 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword((current) => !current)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </FormField>
                <StaggerItem y={8}>
                  <Link
                    href="/forgot-password"
                    className="block text-right text-xs text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                </StaggerItem>
              </Stagger>

              <Magnetic strength={0.15} className="mt-4 flex w-full">
                <Button
                  type="submit"
                  className="sheen w-full"
                  size="lg"
                  disabled={login.isPending}
                >
                  <LogIn className="h-4 w-4" />
                  {login.isPending ? "Signing in…" : "Sign in"}
                </Button>
              </Magnetic>
            </form>

            <Separator />
            <p className="text-center text-sm text-muted-foreground">
              New here?{" "}
              <Link href="/signup" className="font-medium text-primary hover:underline">
                Create an account
              </Link>
            </p>
            <p className="text-center text-sm text-muted-foreground">
              Want to teach?{" "}
              <Link href="/teach" className="font-medium text-primary hover:underline">
                Become an instructor
              </Link>
            </p>
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-4 py-16">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}

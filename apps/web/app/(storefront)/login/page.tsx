"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStore } from "@/lib/context/store";
import { Logo } from "@/components/shared/logo";
import { Reveal, Stagger, StaggerItem, Magnetic } from "@/components/shared/motion";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { User, Shield, Sparkles, GraduationCap } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const { loginAs, loginAsInstructor } = useStore();
  const router = useRouter();
  const [email, setEmail] = useState("student@demo.com");
  const [password, setPassword] = useState("demo1234");

  function go(role: "student" | "admin") {
    loginAs(role);
    toast.success(`Welcome back!`, { description: role === "admin" ? "Signed in as Admin" : "Signed in as student" });
    router.push(role === "admin" ? "/admin" : "/dashboard");
  }

  function goInstructor() {
    loginAsInstructor();
    toast.success("Welcome back!", { description: "Signed in as instructor" });
    router.push("/instructor");
  }

  return (
    <div className="relative mx-auto flex min-h-[80vh] max-w-md flex-col justify-center overflow-hidden px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-104 w-104 -translate-x-1/2 -translate-y-1/3 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--aurora-2)_32%,transparent),transparent)] opacity-0 blur-3xl dark:opacity-40"
      />
      <Reveal y={16}>
        <div className="mb-6 flex justify-center"><Logo /></div>
      </Reveal>

      <Reveal y={20} delay={0.06}>
        <Card className="border-border/80 shadow-xl shadow-primary/3 dark:shadow-black/20">
          <CardContent className="space-y-5 pt-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold">Welcome back</h1>
              <p className="text-sm text-muted-foreground">Log in to continue learning</p>
            </div>

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">
              <p className="flex items-center gap-1.5 font-medium text-primary">
                <Sparkles className="h-3.5 w-3.5 animate-pulse" /> Demo accounts
              </p>
              <p className="mt-1 text-muted-foreground">Use the quick buttons below, or any email/password — this is a prototype.</p>
            </div>

            <Stagger className="space-y-3" gap={0.06}>
              <FormField label="Email" htmlFor="email">
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </FormField>
              <FormField label="Password" htmlFor="password">
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </FormField>
              <StaggerItem y={8}>
                <Link href="#" className="block text-right text-xs text-primary hover:underline">Forgot password?</Link>
              </StaggerItem>
            </Stagger>

            <Magnetic strength={0.15} className="flex w-full">
              <Button className="sheen w-full" size="lg" onClick={() => go("student")}>
                <User /> Log in as student
              </Button>
            </Magnetic>
            <div className="grid grid-cols-2 gap-2">
              <Button size="lg" variant="outline" className="transition-transform hover:-translate-y-0.5" onClick={goInstructor}>
                <GraduationCap /> Instructor
              </Button>
              <Button size="lg" variant="outline" className="transition-transform hover:-translate-y-0.5" onClick={() => go("admin")}>
                <Shield /> Admin
              </Button>
            </div>

            <Separator />
            <p className="text-center text-sm text-muted-foreground">
              New here?{" "}
              <Link href="/signup" className="font-medium text-primary hover:underline">Create an account</Link>
            </p>
            <p className="text-center text-sm text-muted-foreground">
              Want to teach?{" "}
              <Link href="/teach" className="font-medium text-primary hover:underline">Become an instructor</Link>
            </p>
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}

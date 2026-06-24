"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/context/store";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Check } from "lucide-react";
import { toast } from "sonner";

const perks = ["500,000+ learners", "Region-fair pricing", "Certificates of completion", "30-day guarantee"];

export default function SignupPage() {
  const { login } = useStore();
  const router = useRouter();

  function create() {
    login();
    toast.success("Account created!", { description: "Welcome to SkillStream 🎉" });
    router.push("/dashboard");
  }

  return (
    <div className="mx-auto grid min-h-[80vh] max-w-4xl items-center gap-10 px-4 py-12 md:grid-cols-2">
      <div className="hidden md:block">
        <Logo className="mb-6" />
        <h1 className="text-3xl font-bold tracking-tight">Start learning today</h1>
        <p className="mt-3 text-muted-foreground">Join half a million learners growing their skills on SkillStream.</p>
        <ul className="mt-6 space-y-3">
          {perks.map((p) => (
            <li key={p} className="flex items-center gap-2 text-sm">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-success/15 text-success"><Check className="h-3 w-3" /></span>
              {p}
            </li>
          ))}
        </ul>
      </div>

      <Card>
        <CardContent className="space-y-5 pt-6">
          <div className="flex justify-center md:hidden"><Logo /></div>
          <div className="text-center">
            <h2 className="text-2xl font-bold">Create your account</h2>
            <p className="text-sm text-muted-foreground">It's free to get started</p>
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Full name</Label><Input placeholder="Alex Morgan" /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" placeholder="you@example.com" /></div>
            <div className="space-y-1.5"><Label>Password</Label><Input type="password" placeholder="Create a password" /></div>
          </div>
          <Button className="w-full" size="lg" onClick={create}>Create account</Button>
          <p className="text-center text-xs text-muted-foreground">
            By signing up you agree to our Terms & Privacy Policy.
          </p>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">Log in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

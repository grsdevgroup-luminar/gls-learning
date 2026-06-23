"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStore } from "@/lib/context/store";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { User, Shield, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const { loginAs } = useStore();
  const router = useRouter();
  const [email, setEmail] = useState("student@demo.com");
  const [password, setPassword] = useState("demo1234");

  function go(role: "student" | "admin") {
    loginAs(role);
    toast.success(`Welcome back!`, { description: role === "admin" ? "Signed in as Admin" : "Signed in as student" });
    router.push(role === "admin" ? "/admin" : "/dashboard");
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-6 flex justify-center"><Logo /></div>
      <Card>
        <CardContent className="space-y-5 pt-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Welcome back</h1>
            <p className="text-sm text-muted-foreground">Log in to continue learning</p>
          </div>

          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">
            <p className="flex items-center gap-1.5 font-medium text-primary"><Sparkles className="h-3.5 w-3.5" /> Demo accounts</p>
            <p className="mt-1 text-muted-foreground">Use the quick buttons below, or any email/password — this is a prototype.</p>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Link href="#" className="block text-right text-xs text-primary hover:underline">Forgot password?</Link>
          </div>

          <Button className="w-full" size="lg" onClick={() => go("student")}>
            <User /> Log in as student
          </Button>
          <Button className="w-full" size="lg" variant="outline" onClick={() => go("admin")}>
            <Shield /> Log in as admin
          </Button>

          <Separator />
          <p className="text-center text-sm text-muted-foreground">
            New here?{" "}
            <Link href="/signup" className="font-medium text-primary hover:underline">Create an account</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

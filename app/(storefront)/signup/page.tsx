'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/context/store';
import { Logo } from '@/components/shared/logo';
import { Reveal, Stagger, StaggerItem, Magnetic } from '@/components/shared/motion';
import { FormField } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Check } from 'lucide-react';
import { toast } from 'sonner';

const perks = [
  '500,000+ learners',
  'Region-fair pricing',
  'Certificates of completion',
  '30-day guarantee',
];

export default function SignupPage() {
  const { login } = useStore();
  const router = useRouter();

  function create() {
    login();
    toast.success('Account created!', {
      description: 'Welcome to SkillStream 🎉',
    });
    router.push('/dashboard');
  }

  return (
    <div className="relative mx-auto grid min-h-[80vh] max-w-4xl items-center gap-10 overflow-hidden px-4 py-12 md:grid-cols-2">
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-1/2 -z-10 h-104 w-104 -translate-y-1/2 translate-x-1/3 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--aurora-3)_30%,transparent),transparent)] opacity-0 blur-3xl dark:opacity-40"
      />
      <Reveal y={20} className="hidden md:block">
        <Logo className="mb-6" />
        <h1 className="text-3xl font-bold tracking-tight">
          Start learning today
        </h1>
        <p className="mt-3 text-muted-foreground">
          Join half a million learners growing their skills on SkillStream.
        </p>
        <Stagger className="mt-6 space-y-3" gap={0.08}>
          {perks.map((p) => (
            <StaggerItem key={p} y={10} className="flex items-center gap-2 text-sm">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-success/15 text-success">
                <Check className="h-3 w-3" />
              </span>
              {p}
            </StaggerItem>
          ))}
        </Stagger>
      </Reveal>

      <Reveal y={20} delay={0.08}>
        <Card className="border-border/80 shadow-xl shadow-primary/3 dark:shadow-black/20">
          <CardContent className="space-y-5 pt-6">
            <div className="flex justify-center md:hidden">
              <Logo />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold">Create your account</h2>
              <p className="text-sm text-muted-foreground">
                It&apos;s free to get started
              </p>
            </div>
            <Stagger className="space-y-3" gap={0.06}>
              <FormField label="Full name">
                <Input placeholder="Alex Morgan" />
              </FormField>
              <FormField label="Email">
                <Input type="email" placeholder="you@example.com" />
              </FormField>
              <FormField label="Password">
                <Input type="password" placeholder="Create a password" />
              </FormField>
            </Stagger>
            <Magnetic strength={0.15} className="flex w-full">
              <Button className="sheen w-full" size="lg" onClick={create}>
                Create account
              </Button>
            </Magnetic>
            <p className="text-center text-xs text-muted-foreground">
              By signing up you agree to our Terms & Privacy Policy.
            </p>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link
                href="/login"
                className="font-medium text-primary hover:underline"
              >
                Log in
              </Link>
            </p>
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useRegister } from '@/lib/api/session';
import { useStore } from '@/lib/context/store';
import { ApiError } from '@/lib/api/errors';
import { Logo } from '@/components/shared/logo';
import { Reveal, Stagger, StaggerItem, Magnetic } from '@/components/shared/motion';
import { FormField } from '@/components/shared/form-field';
import { CountryField } from '@/components/shared/country-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { CoursePreferencesModal } from '@/components/shared/course-preferences-modal';
import { Check, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { registerSchema } from '@skillstream/shared';
import { getReferralCode } from '@/lib/referral';
import { PasswordRequirements } from '@/components/shared/password-requirements';

const perks = [
  '500,000+ learners',
  'Region-fair pricing',
  'Certificates of completion',
];

function SignupForm() {
  const register = useRegister();
  const { setRegionCode } = useStore();
  const params = useSearchParams();
  // Carried from an org-invite link: prefill the invited email and return to
  // the join page (which auto-claims) after the account is created.
  const next = params.get('next');
  const [name, setName] = useState('');
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [country, setCountry] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [preferenceOpen, setPreferenceOpen] = useState(false);


  async function create() {
    const result = registerSchema.safeParse({
      name,
      email,
      password,
      country,
    });
    if (!result.success) {
      setValidationError(result.error.issues[0]?.message ?? 'Enter valid account details');
      return;
    }
    setValidationError(null);
    try {
      await register.mutateAsync(result.data);
      // Pricing regions use ISO alpha-2 codes, which are carried alongside
      // the country name in the signup selector. Persist it before redirecting
      // so cart and checkout quote the same selected billing region.
      if (country) setRegionCode(country);
      toast.success('Account created!', {
        description: 'Welcome to GRS Learning 🎉',
      });
      // Hard navigation, not router.push — see login/page.tsx for why: `next`
      // can point at a protected route (e.g. an org-invite join link) that may
      // already be sitting in the router cache as a stale pre-auth redirect.
      setPreferenceOpen(true);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.displayMessage : 'Sign up failed';
      toast.error('Could not create account', { description: message });
    }
  }

  return (
    <>
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
          Join half a million learners growing their skills on GRS Learning.
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
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void create();
              }}
            >
              <Stagger className="space-y-3" gap={0.06}>
                <FormField label="Full name">
                  <Input
                    placeholder="Alex Morgan"
                    required
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setValidationError(null);
                    }}
                  />
                </FormField>
                <FormField label="Email">
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value.toLowerCase());
                      setValidationError(null);
                    }}
                  />
                </FormField>
                <FormField label="Country">
                  <CountryField
                    value={country}
                    onChange={(code) => {
                      setCountry(code);
                      setValidationError(null);
                    }}
                  />
                </FormField>
                <FormField label="Password" htmlFor="signup-password">
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Create a password (min 8 chars)"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setValidationError(null);
                      }}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-8 w-9 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword((current) => !current)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </FormField>
                <PasswordRequirements value={password} />
              </Stagger>
              {validationError && (
                <p role="alert" className="mt-3 text-sm text-destructive">
                  {validationError}
                </p>
              )}
              <Magnetic strength={0.15} className="mt-4 flex w-full">
                <Button type="submit" className="sheen w-full" size="lg" disabled={register.isPending}>
                  {register.isPending ? 'Creating…' : 'Create account'}
                </Button>
              </Magnetic>
            </form>
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
            <p className="text-center text-sm text-muted-foreground">
              Want to teach?{' '}
              <Link href="/teach" className="font-medium text-primary hover:underline">
                Become an instructor
              </Link>
            </p>
          </CardContent>
        </Card>
      </Reveal>
    </div>
    <CoursePreferencesModal
      open={preferenceOpen}
      onSaved={() => { window.location.href = next || "/dashboard"; }}
    />
    </>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-4 py-16">Loading…</div>}>
      <SignupForm />
    </Suspense>
  );
}

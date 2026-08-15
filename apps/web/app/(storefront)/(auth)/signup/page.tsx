'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { useRegister } from '@/lib/api/session';
import { ApiError } from '@/lib/api/errors';
import { Logo } from '@/components/shared/logo';
import { Reveal, Stagger, StaggerItem, Magnetic } from '@/components/shared/motion';
import { FormField } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Check, ChevronsUpDown, Eye, EyeOff, Search } from 'lucide-react';
import { toast } from 'sonner';
import { COUNTRIES, flagFor } from '@/lib/countries';

const perks = [
  '500,000+ learners',
  'Region-fair pricing',
  'Certificates of completion',
  '30-day guarantee',
];

function SignupForm() {
  const register = useRegister();
  const params = useSearchParams();
  // Carried from an org-invite link: prefill the invited email and return to
  // the join page (which auto-claims) after the account is created.
  const next = params.get('next');
  const [name, setName] = useState('');
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [country, setCountry] = useState<string>('');
  const [countryOpen, setCountryOpen] = useState(false);
  const [countryQuery, setCountryQuery] = useState('');

  const filteredCountries = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q));
  }, [countryQuery]);

  async function create() {
    try {
      await register.mutateAsync({
        name,
        email,
        password,
        country: country || undefined,
      });
      toast.success('Account created!', {
        description: 'Welcome to GRS Learning 🎉',
      });
      // Hard navigation, not router.push — see login/page.tsx for why: `next`
      // can point at a protected route (e.g. an org-invite join link) that may
      // already be sitting in the router cache as a stale pre-auth redirect.
      window.location.href = next || '/courses';
    } catch (err) {
      const message =
        err instanceof ApiError ? err.displayMessage : 'Sign up failed';
      toast.error('Could not create account', { description: message });
    }
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
                  <Input placeholder="Alex Morgan" value={name} onChange={(e) => setName(e.target.value)} />
                </FormField>
                <FormField label="Email">
                  <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                </FormField>
                <FormField label="Country">
                  <Popover open={countryOpen} onOpenChange={setCountryOpen}>
                    <PopoverTrigger
                      render={
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-between font-normal"
                        />
                      }
                    >
                      {country ? (
                        <span className="flex items-center gap-2 truncate">
                          <span>
                            {flagFor(
                              COUNTRIES.find((c) => c.name === country)?.code ?? '',
                            )}
                          </span>
                          <span className="truncate">{country}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Select your country</span>
                      )}
                      <ChevronsUpDown className="h-4 w-4 opacity-50" />
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-[var(--anchor-width)] p-0">
                      <div className="relative border-b p-2">
                        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={countryQuery}
                          onChange={(e) => setCountryQuery(e.target.value)}
                          placeholder="Search country…"
                          className="h-8 pl-8"
                          autoFocus
                        />
                      </div>
                      <ul className="max-h-64 overflow-y-auto py-1">
                        {filteredCountries.length === 0 ? (
                          <li className="px-3 py-2 text-sm text-muted-foreground">
                            No matches
                          </li>
                        ) : (
                          filteredCountries.map((c) => (
                            <li key={c.code}>
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
                                onClick={() => {
                                  setCountry(c.name);
                                  setCountryOpen(false);
                                  setCountryQuery('');
                                }}
                              >
                                <span>{flagFor(c.code)}</span>
                                <span className="flex-1 truncate">{c.name}</span>
                                {country === c.name && (
                                  <Check className="h-4 w-4 text-primary" />
                                )}
                              </button>
                            </li>
                          ))
                        )}
                      </ul>
                    </PopoverContent>
                  </Popover>
                </FormField>
                <FormField label="Password" htmlFor="signup-password">
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Create a password (min 8 chars)"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
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
              </Stagger>
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
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-4 py-16">Loading…</div>}>
      <SignupForm />
    </Suspense>
  );
}

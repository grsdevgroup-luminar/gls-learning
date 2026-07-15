'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession, SESSION_QUERY_KEY } from '@/lib/api/session';
import { apiFetch } from '@/lib/api/client';
import { initials } from '@/lib/format';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Reveal, Stagger, StaggerItem, Magnetic } from '@/components/shared/motion';
import { FormField } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Mail, MessageSquare, Bell, Lock } from 'lucide-react';
import { toast } from 'sonner';

const reminderRows = [
  {
    key: 'idle',
    title: 'Idle reminders',
    desc: "Nudge me if I haven't studied in a few days",
  },
  {
    key: 'low_progress',
    title: 'Stalled progress',
    desc: 'Encourage me when I fall behind',
  },
  {
    key: 'almost_done',
    title: 'Almost done',
    desc: "Celebrate when I'm close to finishing",
  },
  {
    key: 'promotions',
    title: 'Promotions & offers',
    desc: 'Deals, new courses, and discounts',
  },
] as const;

export default function AccountPage() {
  const { user, isLoading } = useSession();
  const qc = useQueryClient();

  // Profile form state — initialised from session once loaded
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [profileReady, setProfileReady] = useState(false);

  // Initialise form values from the session exactly once
  if (!profileReady && user) {
    setName(user.name ?? '');
    setCountry(user.country ?? '');
    setProfileReady(true);
  }

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Notification prefs (local — persisted to localStorage)
  const [prefs, setPrefs] = useState<Record<string, { email: boolean; sms: boolean }>>(() => {
    if (typeof window === 'undefined') {
      return {
        idle: { email: true, sms: true },
        low_progress: { email: true, sms: false },
        almost_done: { email: true, sms: false },
        promotions: { email: true, sms: false },
      };
    }
    try {
      const saved = localStorage.getItem('skillstream:notif-prefs');
      return saved
        ? JSON.parse(saved)
        : {
            idle: { email: true, sms: true },
            low_progress: { email: true, sms: false },
            almost_done: { email: true, sms: false },
            promotions: { email: true, sms: false },
          };
    } catch {
      return {
        idle: { email: true, sms: true },
        low_progress: { email: true, sms: false },
        almost_done: { email: true, sms: false },
        promotions: { email: true, sms: false },
      };
    }
  });

  function toggle(key: string, channel: 'email' | 'sms') {
    setPrefs((p) => {
      const next = { ...p, [key]: { ...p[key], [channel]: !p[key][channel] } };
      try { localStorage.setItem('skillstream:notif-prefs', JSON.stringify(next)); } catch {}
      return next;
    });
  }

  // Profile mutation
  const profileMutation = useMutation({
    mutationFn: () =>
      apiFetch<void>('/auth/me/profile', {
        method: 'PATCH',
        body: { name: name.trim(), country: country.trim() || null },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      toast.success('Profile saved');
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to save profile');
    },
  });

  // Password mutation
  const passwordMutation = useMutation({
    mutationFn: () =>
      apiFetch<void>('/auth/me/password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      }),
    onSuccess: () => {
      toast.success('Password updated');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to update password');
    },
  });

  function handlePasswordSubmit() {
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    passwordMutation.mutate();
  }

  if (isLoading) {
    return (
      <div className="space-y-8 p-6 md:p-8">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Account</h1>
        <p className="text-muted-foreground">
          Manage your profile and notification preferences.
        </p>
      </div>

      {/* Profile */}
      <Reveal y={20}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 transition-transform duration-300 hover:scale-105">
                <AvatarFallback className="brand-gradient text-lg text-white">
                  {initials(user?.name ?? '?')}
                </AvatarFallback>
              </Avatar>
              <Button variant="outline" size="sm">
                Change photo
              </Button>
            </div>
            <Stagger className="grid gap-4 sm:grid-cols-2" gap={0.05}>
              <FormField label="Full name">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                />
              </FormField>
              <FormField label="Email">
                <Input
                  value={user?.email ?? ''}
                  type="email"
                  readOnly
                  className="cursor-not-allowed opacity-60"
                />
              </FormField>
              <FormField label="Country">
                <Input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="e.g. United States"
                />
              </FormField>
            </Stagger>
            <Magnetic strength={0.15}>
              <Button
                className="sheen"
                disabled={profileMutation.isPending}
                onClick={() => profileMutation.mutate()}
              >
                {profileMutation.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </Magnetic>
          </CardContent>
        </Card>
      </Reveal>

      {/* Password */}
      <Reveal y={20} delay={0.06}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="h-4 w-4 text-primary" /> Password
            </CardTitle>
            <CardDescription>
              Choose a strong password of at least 8 characters.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Stagger className="grid gap-4 sm:grid-cols-2" gap={0.05}>
              <FormField label="Current password" className="sm:col-span-2">
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </FormField>
              <FormField label="New password">
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </FormField>
              <FormField label="Confirm new password">
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </FormField>
            </Stagger>
            <Button
              variant="outline"
              disabled={passwordMutation.isPending || !currentPassword || !newPassword}
              onClick={handlePasswordSubmit}
            >
              {passwordMutation.isPending ? 'Updating…' : 'Update password'}
            </Button>
          </CardContent>
        </Card>
      </Reveal>

      {/* Notification preferences */}
      <Reveal y={20} delay={0.12}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4 text-primary" /> Notification preferences
            </CardTitle>
            <CardDescription>
              Choose how SkillStream keeps you on track. This powers the automated
              reminder system.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="hidden grid-cols-[1fr_80px_80px] items-center gap-2 px-1 pb-2 text-xs font-medium text-muted-foreground sm:grid">
              <span />
              <span className="flex items-center justify-center gap-1">
                <Mail className="h-3.5 w-3.5" /> Email
              </span>
              <span className="flex items-center justify-center gap-1">
                <MessageSquare className="h-3.5 w-3.5" /> SMS
              </span>
            </div>
            <Stagger gap={0.04}>
              {reminderRows.map((r, i) => (
                <StaggerItem key={r.key} y={10}>
                  {i > 0 && <Separator />}
                  <div className="grid grid-cols-[1fr_auto] items-center gap-4 py-3 sm:grid-cols-[1fr_80px_80px]">
                    <div>
                      <div className="text-sm font-medium">{r.title}</div>
                      <div className="text-xs text-muted-foreground">{r.desc}</div>
                    </div>
                    <div className="flex items-center gap-6 sm:contents">
                      <div className="flex items-center gap-2 sm:justify-center">
                        <span className="text-xs text-muted-foreground sm:hidden">
                          Email
                        </span>
                        <Switch
                          checked={prefs[r.key].email}
                          onCheckedChange={() => toggle(r.key, 'email')}
                        />
                      </div>
                      <div className="flex items-center gap-2 sm:justify-center">
                        <span className="text-xs text-muted-foreground sm:hidden">
                          SMS
                        </span>
                        <Switch
                          checked={prefs[r.key].sms}
                          onCheckedChange={() => toggle(r.key, 'sms')}
                        />
                      </div>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
            <p className="pt-3 text-xs text-muted-foreground">
              In production these preferences drive automated email
              (Resend/SendGrid) and SMS (Twilio) reminder workflows.
            </p>
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}

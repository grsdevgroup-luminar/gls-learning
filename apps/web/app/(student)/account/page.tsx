'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  REMINDER_TRIGGERS,
  REMINDER_TRIGGER_COPY,
  DEFAULT_NOTIFICATION_PREFS,
  type ReminderTrigger,
} from '@skillstream/shared';
import { api } from '@/lib/api/endpoints';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Mail, MessageSquare, Bell, Lock } from 'lucide-react';
import { toast } from 'sonner';

export default function AccountPage() {
  const { user, isLoading } = useSession();
  const qc = useQueryClient();

  // Profile form state — initialised from session once loaded
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [avatar, setAvatar] = useState('');
  const [phone, setPhone] = useState('');
  const [profileReady, setProfileReady] = useState(false);

  // Initialise form values from the session exactly once
  if (!profileReady && user) {
    setName(user.name ?? '');
    setCountry(user.country ?? '');
    setAvatar(user.avatar ?? '');
    setPhone(user.phone ?? '');
    setProfileReady(true);
  }

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Notification prefs — server-side; they gate real reminder delivery.
  const { data: prefs = DEFAULT_NOTIFICATION_PREFS } = useQuery({
    queryKey: ['me', 'notification-preferences'],
    queryFn: api.notificationPrefs,
  });
  const prefsMutation = useMutation({
    mutationFn: api.updateNotificationPrefs,
    onSuccess: (next) => {
      qc.setQueryData(['me', 'notification-preferences'], next);
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to save preferences'),
  });

  function toggle(trigger: ReminderTrigger, channel: 'email' | 'sms') {
    prefsMutation.mutate({ [trigger]: { [channel]: !prefs[trigger][channel] } });
  }

  // Profile mutation
  const profileMutation = useMutation({
    mutationFn: () =>
      apiFetch<void>('/auth/me/profile', {
        method: 'PATCH',
        body: {
          name: name.trim(),
          country: country.trim().toUpperCase() || null,
          avatar: avatar.trim() || null,
          phone: phone.trim() || null,
        },
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
                {avatar && <AvatarImage src={avatar} alt="" />}
                <AvatarFallback className="brand-gradient text-lg text-white">
                  {initials(user?.name ?? '?')}
                </AvatarFallback>
              </Avatar>
              {/* No image hosting on this platform (Cloudflare Stream is video
                  only), so the avatar is a link to an image you already host. */}
              <FormField label="Photo URL" className="flex-1">
                <Input
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                  placeholder="https://example.com/me.jpg"
                  type="url"
                />
              </FormField>
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
              {/* Where SMS reminders go; without one they're skipped. */}
              <FormField label="Phone" hint="For SMS reminders">
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+8801712345678"
                  type="tel"
                />
              </FormField>
              {/* The API stores an ISO-3166 alpha-2 code — a country *name*
                  here used to fail validation. */}
              <FormField label="Country code">
                <Input
                  value={country}
                  onChange={(e) => setCountry(e.target.value.toUpperCase().slice(0, 2))}
                  placeholder="US"
                  maxLength={2}
                  className="uppercase"
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
              {REMINDER_TRIGGERS.map((trigger, i) => (
                <StaggerItem key={trigger} y={10}>
                  {i > 0 && <Separator />}
                  <div className="grid grid-cols-[1fr_auto] items-center gap-4 py-3 sm:grid-cols-[1fr_80px_80px]">
                    <div>
                      <div className="text-sm font-medium">
                        {REMINDER_TRIGGER_COPY[trigger].title}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {REMINDER_TRIGGER_COPY[trigger].description}
                      </div>
                    </div>
                    <div className="flex items-center gap-6 sm:contents">
                      <div className="flex items-center gap-2 sm:justify-center">
                        <span className="text-xs text-muted-foreground sm:hidden">
                          Email
                        </span>
                        <Switch
                          checked={prefs[trigger].email}
                          disabled={prefsMutation.isPending}
                          onCheckedChange={() => toggle(trigger, 'email')}
                        />
                      </div>
                      <div className="flex items-center gap-2 sm:justify-center">
                        <span className="text-xs text-muted-foreground sm:hidden">
                          SMS
                        </span>
                        <Switch
                          checked={prefs[trigger].sms}
                          disabled={prefsMutation.isPending}
                          onCheckedChange={() => toggle(trigger, 'sms')}
                        />
                      </div>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
            <p className="pt-3 text-xs text-muted-foreground">
              Email reminders go out through Resend, SMS through Twilio. SMS
              needs a phone number on your profile above — without one those
              reminders are skipped.
            </p>
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}

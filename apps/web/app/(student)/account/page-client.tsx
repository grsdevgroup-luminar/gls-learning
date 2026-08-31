'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  REMINDER_TRIGGERS,
  REMINDER_TRIGGER_COPY,
  DEFAULT_NOTIFICATION_PREFS,
  isIsoCountryCode,
  isValidPhone,
  passwordSchema,
  type ReminderTrigger,
} from '@skillstream/shared';
import { api } from '@/lib/api/endpoints';
import { useSession, SESSION_QUERY_KEY } from '@/lib/api/session';
import { apiFetch, apiFetchMultipart } from '@/lib/api/client';
import { initials } from '@/lib/format';
import { CountrySelect } from '@/components/shared/country-select';
import { PhoneInput } from '@/components/shared/phone-input';
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
import { Mail, MessageSquare, Bell, Eye, EyeOff, Lock, Upload, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

// Kept in sync with AVATAR_MAX_BYTES on the API — mirrored client-side so the
// picker can reject oversize files before the network round-trip.
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const AVATAR_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';

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
    setCountry(
      user.country && isIsoCountryCode(user.country) ? user.country : '',
    );
    setAvatar(user.avatar ?? '');
    setPhone(user.phone ?? '');
    setProfileReady(true);
  }

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

  function handleProfileSubmit() {
    if (!name.trim()) {
      toast.error('Name is required. Please enter your name.');
      return;
    }
    if (!phone.trim()) {
      toast.error('Please enter your phone number.');
      return;
    }
    if (!country) {
      toast.error('Please select your country so we can validate your phone number.');
      return;
    }
    if (!isValidPhone(phone.trim())) {
      toast.error('Please enter a valid phone number for the selected country.');
      return;
    }
    profileMutation.mutate();
  }

  // Profile mutation
  const profileMutation = useMutation({
    mutationFn: () =>
      apiFetch<void>('/auth/me/profile', {
        method: 'PATCH',
        body: {
          name: name.trim(),
          country: country || null,
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

  // Avatar upload / delete. Both flip the session cache so the header avatar
  // updates immediately; the API returns the fully resolved URL.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAvatar = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return apiFetchMultipart<{ avatar: string | null }>(
        '/auth/me/avatar',
        form,
      );
    },
    onSuccess: (next) => {
      setAvatar(next.avatar ?? '');
      qc.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      toast.success('Photo updated');
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to upload photo');
    },
  });
  const deleteAvatar = useMutation({
    mutationFn: () =>
      apiFetch<{ avatar: string | null }>('/auth/me/avatar', {
        method: 'DELETE',
      }),
    onSuccess: (next) => {
      setAvatar(next.avatar ?? '');
      qc.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      toast.success('Photo removed');
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to remove photo');
    },
  });

  function handleFilePicked(file: File | undefined) {
    if (!file) return;
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error(
        `Photo must be under ${Math.floor(AVATAR_MAX_BYTES / (1024 * 1024))} MB`,
      );
      return;
    }
    uploadAvatar.mutate(file);
  }

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
    if (currentPassword === newPassword) {
      toast.error('New password must be different from your current password');
      return;
    }
    const passwordResult = passwordSchema.safeParse(newPassword);
    if (!passwordResult.success) {
      toast.error(passwordResult.error.issues[0]?.message ?? 'Password does not meet the requirements');
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
              <div className="flex-1 space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={AVATAR_ACCEPT}
                  className="hidden"
                  onChange={(e) => {
                    handleFilePicked(e.target.files?.[0]);
                    // Reset so re-picking the same file re-fires onChange.
                    e.target.value = '';
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadAvatar.isPending}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    {uploadAvatar.isPending
                      ? 'Uploading…'
                      : avatar
                        ? 'Change photo'
                        : 'Upload photo'}
                  </Button>
                  {avatar && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={deleteAvatar.isPending}
                      onClick={() => deleteAvatar.mutate()}
                    >
                      <Trash2 className="h-4 w-4" />
                      {deleteAvatar.isPending ? 'Removing…' : 'Remove'}
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  PNG, JPG, WebP, or GIF. Max 5 MB.
                </p>
              </div>
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
              <FormField label="Country" hint="Sets your phone's calling code">
                <CountrySelect value={country} onChange={setCountry} />
              </FormField>
              {/* Where SMS reminders go; without one they're skipped. */}
              <FormField label="Phone" hint="For SMS reminders">
                <PhoneInput country={country} value={phone} onChange={setPhone} />
              </FormField>
            </Stagger>
            <Magnetic strength={0.15}>
              <Button
                className="sheen"
                disabled={profileMutation.isPending}
                onClick={handleProfileSubmit}
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
                <div className="relative">
                  <Input
                    id="current-password"
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-8 w-9 text-muted-foreground hover:text-foreground"
                    aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                    aria-pressed={showCurrentPassword}
                    aria-controls="current-password"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setShowCurrentPassword((current) => !current)}
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </FormField>
              <FormField label="New password">
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-8 w-9 text-muted-foreground hover:text-foreground"
                    aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                    aria-pressed={showNewPassword}
                    aria-controls="new-password"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setShowNewPassword((current) => !current)}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </FormField>
              <FormField label="Confirm new password">
                <div className="relative">
                  <Input
                    id="confirm-new-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-8 w-9 text-muted-foreground hover:text-foreground"
                    aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'}
                    aria-pressed={showConfirmPassword}
                    aria-controls="confirm-new-password"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setShowConfirmPassword((current) => !current)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </FormField>
            </Stagger>
            <Button
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
              Choose how GRS Learning keeps you on track. This powers the automated
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


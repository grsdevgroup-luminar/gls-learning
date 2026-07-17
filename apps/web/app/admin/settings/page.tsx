'use client';

import { useEffect, useState } from 'react';
import { useAdminSettings, useUpdateSettings } from '@/lib/api/hooks';
import { getApiErrorMessage } from '@/lib/api/errors';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Building2, Users2, Bell, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/** Admin notification toggles. Keys are persisted in `settings.notifications`. */
const NOTIFICATION_TOGGLES: { key: string; label: string }[] = [
  { key: 'newEnrollment', label: 'New enrollment alerts' },
  { key: 'dailyRevenue', label: 'Daily revenue summary' },
  { key: 'atRiskDigest', label: 'At-risk student digest' },
  { key: 'newReview', label: 'New review notifications' },
];

export default function AdminSettings() {
  const { data: settings, isLoading } = useAdminSettings();
  const update = useUpdateSettings();

  // Local draft for the General card only — it saves on an explicit button.
  // Toggles persist immediately, so they read straight from the server value.
  const [general, setGeneral] = useState({
    platformName: '',
    supportEmail: '',
    baseCurrency: '',
    defaultLanguage: '',
  });

  useEffect(() => {
    if (!settings) return;
    setGeneral({
      platformName: settings.platformName,
      supportEmail: settings.supportEmail,
      baseCurrency: settings.baseCurrency,
      defaultLanguage: settings.defaultLanguage,
    });
  }, [settings]);

  function save(input: Parameters<typeof update.mutate>[0], msg: string) {
    update.mutate(input, {
      onSuccess: () => toast.success(msg),
      onError: (e) => toast.error(getApiErrorMessage(e)),
    });
  }

  if (isLoading || !settings) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const gateways = [
    {
      id: 'stripe' as const,
      name: 'Stripe',
      desc: 'Cards, Apple Pay, Google Pay',
      on: settings.stripeEnabled,
      field: 'stripeEnabled' as const,
    },
    {
      id: 'paypal' as const,
      name: 'PayPal',
      desc: 'PayPal balance & cards',
      on: settings.paypalEnabled,
      field: 'paypalEnabled' as const,
    },
  ];

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure your platform, payments, and team.
        </p>
      </div>

      {/* General */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-primary" /> General
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Platform name</Label>
              <Input
                value={general.platformName}
                onChange={(e) => setGeneral({ ...general, platformName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Support email</Label>
              <Input
                type="email"
                value={general.supportEmail}
                onChange={(e) => setGeneral({ ...general, supportEmail: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Base currency</Label>
              <Input
                value={general.baseCurrency}
                onChange={(e) => setGeneral({ ...general, baseCurrency: e.target.value })}
                maxLength={3}
                className="uppercase"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Default language</Label>
              <Input
                value={general.defaultLanguage}
                onChange={(e) => setGeneral({ ...general, defaultLanguage: e.target.value })}
              />
            </div>
          </div>
          <Button
            onClick={() => save(general, 'Settings saved')}
            disabled={update.isPending}
          >
            {update.isPending ? 'Saving…' : 'Save'}
          </Button>
        </CardContent>
      </Card>

      {/* Payments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4 text-primary" /> Payment gateways
          </CardTitle>
          <CardDescription>
            Connect the providers your learners can pay with. Disabling one blocks
            it at checkout.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {gateways.map((g) => (
            <div key={g.id} className="flex items-center gap-3 rounded-lg border p-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <CreditCard className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {g.name}{' '}
                  {g.on && (
                    <Badge variant="secondary" className="text-success">
                      <Check className="mr-0.5 h-3 w-3" /> Enabled
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">{g.desc}</div>
              </div>
              <Switch
                checked={g.on}
                onCheckedChange={(v) =>
                  save({ [g.field]: v }, `${g.name} ${v ? 'enabled' : 'disabled'}`)
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Team / instructors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users2 className="h-4 w-4 text-primary" /> Instructors & team
          </CardTitle>
          <CardDescription>
            People who can create and manage courses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Manage instructors from the{' '}
            <a href="/admin/instructors" className="text-primary hover:underline">
              Instructors
            </a>{' '}
            page.
          </p>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4 text-primary" /> Admin notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {NOTIFICATION_TOGGLES.map((n) => (
            <div key={n.key} className="flex items-center justify-between">
              <span className="text-sm">{n.label}</span>
              <Switch
                checked={settings.notifications[n.key] ?? false}
                onCheckedChange={(v) =>
                  save(
                    { notifications: { ...settings.notifications, [n.key]: v } },
                    `${n.label} ${v ? 'on' : 'off'}`,
                  )
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

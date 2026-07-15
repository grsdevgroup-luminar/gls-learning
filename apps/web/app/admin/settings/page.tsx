'use client';

import { useState } from 'react';
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { CreditCard, Building2, Users2, Bell, Check, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminSettings() {
  const [stripe, setStripe] = useState(true);
  const [paypal, setPaypal] = useState(true);

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
              <Input defaultValue="SkillStream" />
            </div>
            <div className="space-y-1.5">
              <Label>Support email</Label>
              <Input defaultValue="support@SkillStream.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Base currency</Label>
              <Input defaultValue="USD" />
            </div>
            <div className="space-y-1.5">
              <Label>Default language</Label>
              <Input defaultValue="English" />
            </div>
          </div>
          <Button onClick={() => toast.success('Settings saved')}>Save</Button>
        </CardContent>
      </Card>

      {/* Payments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4 text-primary" /> Payment gateways
          </CardTitle>
          <CardDescription>
            Connect the providers your learners can pay with.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            {
              id: 'stripe',
              name: 'Stripe',
              desc: 'Cards, Apple Pay, Google Pay',
              on: stripe,
              set: setStripe,
            },
            {
              id: 'paypal',
              name: 'PayPal',
              desc: 'PayPal balance & cards',
              on: paypal,
              set: setPaypal,
            },
          ].map((g) => (
            <div
              key={g.id}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <CreditCard className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {g.name}{' '}
                  {g.on && (
                    <Badge variant="secondary" className="text-success">
                      <Check className="mr-0.5 h-3 w-3" /> Connected
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">{g.desc}</div>
              </div>
              <Switch
                checked={g.on}
                onCheckedChange={(v) => {
                  g.set(v);
                  toast(g.name + (v ? ' enabled' : ' disabled'));
                }}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Team / instructors */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users2 className="h-4 w-4 text-primary" /> Instructors & team
            </CardTitle>
            <CardDescription>
              People who can create and manage courses.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline">
            <Plus /> Invite
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Manage instructors from the{" "}
            <a href="/admin/instructors" className="text-primary hover:underline">Instructors</a> page.
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
          {[
            'New enrollment alerts',
            'Daily revenue summary',
            'At-risk student digest',
            'New review notifications',
          ].map((n, i) => (
            <div key={n} className="flex items-center justify-between">
              <span className="text-sm">{n}</span>
              <Switch defaultChecked={i < 3} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

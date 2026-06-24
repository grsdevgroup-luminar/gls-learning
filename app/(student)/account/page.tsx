"use client";

import { useState } from "react";
import { demoStudent } from "@/lib/mock/students";
import { initials } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Mail, MessageSquare, Bell } from "lucide-react";
import { toast } from "sonner";

const reminderRows = [
  { key: "idle", title: "Idle reminders", desc: "Nudge me if I haven't studied in a few days" },
  { key: "low_progress", title: "Stalled progress", desc: "Encourage me when I fall behind" },
  { key: "almost_done", title: "Almost done", desc: "Celebrate when I'm close to finishing" },
  { key: "promotions", title: "Promotions & offers", desc: "Deals, new courses, and discounts" },
] as const;

export default function AccountPage() {
  const [prefs, setPrefs] = useState<Record<string, { email: boolean; sms: boolean }>>({
    idle: { email: true, sms: true },
    low_progress: { email: true, sms: false },
    almost_done: { email: true, sms: false },
    promotions: { email: true, sms: false },
  });

  function toggle(key: string, channel: "email" | "sms") {
    setPrefs((p) => ({ ...p, [key]: { ...p[key], [channel]: !p[key][channel] } }));
  }

  return (
    <div className="space-y-8 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Account</h1>
        <p className="text-muted-foreground">Manage your profile and notification preferences.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Profile</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="brand-gradient text-lg text-white">{initials(demoStudent.name)}</AvatarFallback>
            </Avatar>
            <Button variant="outline" size="sm">Change photo</Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Full name</Label><Input defaultValue={demoStudent.name} /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input defaultValue={demoStudent.email} type="email" /></div>
            <div className="space-y-1.5"><Label>Phone (for SMS)</Label><Input defaultValue="+1 555 0142" /></div>
            <div className="space-y-1.5"><Label>Country</Label><Input defaultValue={demoStudent.country} /></div>
          </div>
          <Button onClick={() => toast.success("Profile saved")}>Save changes</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Bell className="h-4 w-4 text-primary" /> Notification preferences</CardTitle>
          <CardDescription>Choose how LearnHub keeps you on track. This powers the automated reminder system.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="hidden grid-cols-[1fr_80px_80px] items-center gap-2 px-1 pb-2 text-xs font-medium text-muted-foreground sm:grid">
            <span />
            <span className="flex items-center justify-center gap-1"><Mail className="h-3.5 w-3.5" /> Email</span>
            <span className="flex items-center justify-center gap-1"><MessageSquare className="h-3.5 w-3.5" /> SMS</span>
          </div>
          {reminderRows.map((r, i) => (
            <div key={r.key}>
              {i > 0 && <Separator />}
              <div className="grid grid-cols-[1fr_auto] items-center gap-4 py-3 sm:grid-cols-[1fr_80px_80px]">
                <div>
                  <div className="text-sm font-medium">{r.title}</div>
                  <div className="text-xs text-muted-foreground">{r.desc}</div>
                </div>
                <div className="flex items-center gap-6 sm:contents">
                  <div className="flex items-center gap-2 sm:justify-center">
                    <span className="text-xs text-muted-foreground sm:hidden">Email</span>
                    <Switch checked={prefs[r.key].email} onCheckedChange={() => toggle(r.key, "email")} />
                  </div>
                  <div className="flex items-center gap-2 sm:justify-center">
                    <span className="text-xs text-muted-foreground sm:hidden">SMS</span>
                    <Switch checked={prefs[r.key].sms} onCheckedChange={() => toggle(r.key, "sms")} />
                  </div>
                </div>
              </div>
            </div>
          ))}
          <p className="pt-3 text-xs text-muted-foreground">
            In production these preferences drive automated email (Resend/SendGrid) and SMS (Twilio) reminder workflows.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

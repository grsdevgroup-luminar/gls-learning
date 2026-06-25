"use client";

import { useState } from "react";
import { automationRules as seed, reminderLog, reminderStats } from "@/lib/mock/automation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Send, MailOpen, MousePointerClick, UserCheck, Mail, MessageSquare,
  Clock, TrendingDown, ShoppingCart, PartyPopper, Sparkles, Plus,
} from "lucide-react";
import type { AutomationRule, ReminderTrigger } from "@/types";
import { toast } from "sonner";

const triggerIcon: Record<ReminderTrigger, typeof Clock> = {
  idle: Clock,
  low_progress: TrendingDown,
  abandoned_cart: ShoppingCart,
  almost_done: PartyPopper,
  new_content: Sparkles,
};

const logStatusCls: Record<string, string> = {
  sent: "text-muted-foreground", opened: "text-chart-3", clicked: "text-success", bounced: "text-destructive",
};

export default function AdminMarketing() {
  const [rules, setRules] = useState<AutomationRule[]>(seed);

  function toggle(id: string) {
    setRules((rs) => rs.map((r) => (r.id === id ? { ...r, active: !r.active } : r)));
    const r = rules.find((x) => x.id === id);
    toast.success(`${r?.name} ${r?.active ? "paused" : "activated"}`);
  }

  const stats = [
    { icon: Send, label: "Sent (7 days)", value: reminderStats.sent7d.toLocaleString() },
    { icon: MailOpen, label: "Open rate", value: `${reminderStats.openRate}%` },
    { icon: MousePointerClick, label: "Click rate", value: `${reminderStats.clickRate}%` },
    { icon: UserCheck, label: "Re-activated", value: reminderStats.reactivated },
  ];

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Automation & reminders</h1>
          <p className="text-muted-foreground">Win back idle learners automatically over email & SMS.</p>
        </div>
        <Button onClick={() => toast.success("Opening rule builder…")}><Plus /> New automation</Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><s.icon className="h-5 w-5" /></div>
              <div><div className="text-2xl font-bold leading-none">{s.value}</div><div className="text-xs text-muted-foreground">{s.label}</div></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Rules */}
      <div>
        <h2 className="mb-3 text-lg font-bold">Automation rules</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {rules.map((r) => {
            const Icon = triggerIcon[r.trigger];
            return (
              <Card key={r.id} className={r.active ? "" : "opacity-70"}>
                <CardHeader className="flex-row items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
                    <div>
                      <CardTitle className="text-base">{r.name}</CardTitle>
                      <CardDescription>{r.condition}</CardDescription>
                    </div>
                  </div>
                  <Switch checked={r.active} onCheckedChange={() => toggle(r.id)} />
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    {r.channels.map((c) => (
                      <Badge key={c} variant="secondary" className="gap-1">
                        {c === "email" ? <Mail className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />} {c}
                      </Badge>
                    ))}
                    <span className="ml-auto text-xs text-muted-foreground">{r.sentCount.toLocaleString()} sent</span>
                  </div>
                  <p className="rounded-lg bg-muted/60 p-2.5 text-xs italic text-muted-foreground">“{r.template}”</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Send log */}
      <Card className="p-0">
        <CardHeader className="px-6 pt-6"><CardTitle className="text-base">Recent reminder activity</CardTitle></CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Time</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead className="pr-6">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reminderLog.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="pl-6 text-xs text-muted-foreground">{l.date}</TableCell>
                  <TableCell className="text-sm font-medium">{l.student}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-sm">
                      {l.channel === "email" ? <Mail className="h-3.5 w-3.5" /> : <MessageSquare className="h-3.5 w-3.5" />} {l.channel}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm capitalize text-muted-foreground">{l.trigger.replace("_", " ")}</TableCell>
                  <TableCell className="max-w-48 truncate text-sm">{l.subject}</TableCell>
                  <TableCell className={`pr-6 text-sm capitalize ${logStatusCls[l.status]}`}>{l.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

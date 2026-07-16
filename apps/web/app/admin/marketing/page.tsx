"use client";

import { useState } from "react";
import type {
  AutomationRuleDto,
  ReminderChannel,
  ReminderTrigger,
} from "@skillstream/shared";
import {
  ruleToInput,
  useAutomationRules,
  useCreateAutomationRule,
  useDeleteAutomationRule,
  useReminderLogs,
  useUpdateAutomationRule,
} from "@/lib/api/hooks";
import { getApiErrorMessage } from "@/lib/api/errors";
import { relativeDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Send, MailOpen, MousePointerClick, ListChecks, Mail, MessageSquare,
  Clock, TrendingDown, ShoppingCart, PartyPopper, Sparkles, Plus, Trash2,
} from "lucide-react";
import { toast } from "sonner";

const triggerIcon: Record<ReminderTrigger, typeof Clock> = {
  IDLE: Clock,
  LOW_PROGRESS: TrendingDown,
  ABANDONED_CART: ShoppingCart,
  ALMOST_DONE: PartyPopper,
  NEW_CONTENT: Sparkles,
};

const logStatusCls: Record<string, string> = {
  SENT: "text-muted-foreground",
  OPENED: "text-chart-3",
  CLICKED: "text-success",
  BOUNCED: "text-destructive",
};

const humanize = (s: string) => s.toLowerCase().replace(/_/g, " ");

const ChannelIcon = ({ channel }: { channel: ReminderChannel }) =>
  channel === "EMAIL" ? <Mail className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />;

export default function AdminMarketing() {
  const { data: rules = [], isLoading } = useAutomationRules();
  const { data: logs = [] } = useReminderLogs();
  const create = useCreateAutomationRule();
  const update = useUpdateAutomationRule();
  const remove = useDeleteAutomationRule();

  function toggle(r: AutomationRuleDto) {
    update.mutate(
      { ...ruleToInput(r), id: r.id, active: !r.active },
      {
        onSuccess: () => toast.success(`${r.name} ${r.active ? "paused" : "activated"}`),
        onError: (e) => toast.error(getApiErrorMessage(e)),
      },
    );
  }

  // Derived from the send log rather than stored — the log is the source of truth.
  const weekAgo = Date.now() - 7 * 86400_000;
  const sent7d = logs.filter((l) => Date.parse(l.createdAt) >= weekAgo).length;
  const opened = logs.filter((l) => l.status === "OPENED" || l.status === "CLICKED").length;
  const clicked = logs.filter((l) => l.status === "CLICKED").length;
  const pct = (n: number) => (logs.length ? Math.round((n / logs.length) * 100) : 0);

  const stats = [
    { icon: Send, label: "Sent (7 days)", value: sent7d.toLocaleString() },
    { icon: MailOpen, label: "Open rate", value: `${pct(opened)}%` },
    { icon: MousePointerClick, label: "Click rate", value: `${pct(clicked)}%` },
    { icon: ListChecks, label: "Active rules", value: rules.filter((r) => r.active).length },
  ];

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Automation & reminders</h1>
          <p className="text-muted-foreground">
            Win back idle learners automatically over email & SMS. Rules are evaluated hourly.
          </p>
        </div>
        <NewRuleDialog
          onCreate={(input) =>
            create.mutate(input, {
              onSuccess: (r) => toast.success(`${r.name} created`),
              onError: (e) => toast.error(getApiErrorMessage(e)),
            })
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold leading-none">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Rules */}
      <div>
        <h2 className="mb-3 text-lg font-bold">Automation rules</h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading rules…</p>
        ) : rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">No automation rules yet.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {rules.map((r) => {
              const Icon = triggerIcon[r.trigger];
              return (
                <Card key={r.id} className={r.active ? "" : "opacity-70"}>
                  <CardHeader className="flex-row items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{r.name}</CardTitle>
                        <CardDescription>{r.condition}</CardDescription>
                      </div>
                    </div>
                    <Switch checked={r.active} onCheckedChange={() => toggle(r)} />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      {r.channels.map((c) => (
                        <Badge key={c} variant="secondary" className="gap-1 capitalize">
                          <ChannelIcon channel={c} /> {humanize(c)}
                        </Badge>
                      ))}
                      <span className="ml-auto text-xs text-muted-foreground">
                        {r.sentCount.toLocaleString()} sent
                      </span>
                    </div>
                    <p className="rounded-lg bg-muted/60 p-2.5 text-xs italic text-muted-foreground">
                      “{r.template}”
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() =>
                        remove.mutate(r.id, {
                          onSuccess: () => toast.success(`${r.name} deleted`),
                          onError: (e) => toast.error(getApiErrorMessage(e)),
                        })
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Send log */}
      <Card className="p-0">
        <CardHeader className="px-6 pt-6">
          <CardTitle className="text-base">Recent reminder activity</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {logs.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              No reminders sent yet. Active rules are swept hourly.
            </p>
          ) : (
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
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="pl-6 text-xs text-muted-foreground">
                      {relativeDate(l.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{l.userName ?? "—"}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 text-sm capitalize">
                        <ChannelIcon channel={l.channel} /> {humanize(l.channel)}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm capitalize text-muted-foreground">
                      {humanize(l.trigger)}
                    </TableCell>
                    <TableCell className="max-w-48 truncate text-sm">{l.subject}</TableCell>
                    <TableCell className={`pr-6 text-sm capitalize ${logStatusCls[l.status]}`}>
                      {humanize(l.status)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const TRIGGERS: ReminderTrigger[] = [
  "IDLE",
  "LOW_PROGRESS",
  "ABANDONED_CART",
  "ALMOST_DONE",
  "NEW_CONTENT",
];

function NewRuleDialog({
  onCreate,
}: {
  onCreate: (input: ReturnType<typeof ruleToInput>) => void;
}) {
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState<ReminderTrigger>("IDLE");
  const [condition, setCondition] = useState("");
  const [channels, setChannels] = useState<ReminderChannel[]>(["EMAIL"]);
  const [template, setTemplate] = useState("");

  function submit() {
    if (!name.trim()) return toast.error("Name the rule");
    if (!template.trim()) return toast.error("Add a message template");
    if (channels.length === 0) return toast.error("Pick at least one channel");
    onCreate({
      name: name.trim(),
      trigger,
      condition: condition.trim(),
      channels,
      template: template.trim(),
      active: true,
    });
    setName("");
    setTemplate("");
    setCondition("");
  }

  const toggleChannel = (c: ReminderChannel) =>
    setChannels((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));

  return (
    <Dialog>
      <DialogTrigger render={<Button />}><Plus /> New automation</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New automation rule</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Win back idle learners" />
          </div>
          <div className="space-y-1.5">
            <Label>Trigger</Label>
            <Select value={trigger} onValueChange={(v) => setTrigger(v as ReminderTrigger)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TRIGGERS.map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">{humanize(t)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Condition (description)</Label>
            <Input
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              placeholder="No activity for 7 days"
            />
            <p className="text-xs text-muted-foreground">
              Shown to admins only — the trigger decides who gets matched.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Channels</Label>
            <div className="flex gap-2">
              {(["EMAIL", "SMS"] as ReminderChannel[]).map((c) => (
                <Button
                  key={c}
                  type="button"
                  size="sm"
                  variant={channels.includes(c) ? "secondary" : "outline"}
                  onClick={() => toggleChannel(c)}
                >
                  <ChannelIcon channel={c} /> <span className="capitalize">{humanize(c)}</span>
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Message template</Label>
            <Textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              rows={3}
              placeholder="Hi {{first_name}}, your {{course}} is waiting — you're {{progress}}% there!"
            />
            <p className="text-xs text-muted-foreground">
              Placeholders: {"{{first_name}}"}, {"{{course}}"}, {"{{progress}}"}
            </p>
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <DialogClose render={<Button onClick={submit} />}>Create rule</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

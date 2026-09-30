"use client";

import { useState } from "react";
import type {
  AutomationRuleDto,
  ReminderChannel,
  ReminderLogDto,
  ReminderTrigger,
  UpsertAutomationRuleInput,
} from "@skillstream/shared";
import {
  REMINDER_TRIGGERS,
  MIN_AUTOMATION_COOLDOWN_HOURS,
  MAX_AUTOMATION_COOLDOWN_HOURS,
  automationCooldownHoursSchema,
  idleParamsSchema,
  lowProgressParamsSchema,
  abandonedCartParamsSchema,
  almostDoneParamsSchema,
  newContentParamsSchema,
  upsertAutomationRuleSchema,
} from "@skillstream/shared";
import {
  ruleToInput,
  useAutomationRules,
  useAutomationSchedule,
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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Send, MailOpen, MousePointerClick, ListChecks, Mail, MessageSquare,
  Clock, TrendingDown, ShoppingCart, PartyPopper, Sparkles,
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

const MARKETING_TRIGGERS = new Set<string>(REMINDER_TRIGGERS);

const ChannelIcon = ({ channel }: { channel: ReminderChannel }) =>
  channel === "EMAIL" ? <Mail className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />;

function ReminderLogTable({ logs, emptyMessage }: { logs: ReminderLogDto[]; emptyMessage: string }) {
  if (logs.length === 0) {
    return <p className="px-6 pb-6 text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
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
  );
}

type ActivityTab = "recent" | "marketing";

export default function AdminMarketing() {
  const { data: schedule } = useAutomationSchedule();
  const sweepFrequency = schedule?.sweepTime
    ? `daily at ${schedule.sweepTime} (server time)`
    : "once daily";
  const { data: rules = [], isLoading } = useAutomationRules();
  const { data: logs = [] } = useReminderLogs();
  const [activityTab, setActivityTab] = useState<ActivityTab>("recent");
  const update = useUpdateAutomationRule();

  function toggle(r: AutomationRuleDto) {
    update.mutate(
      { ...ruleToInput(r), id: r.id, active: !r.active },
      {
        onSuccess: () => toast.success(`${r.name} ${r.active ? "paused" : "activated"}`),
        onError: (e) => toast.error(getApiErrorMessage(e)),
      },
    );
  }

  const [weekAgo] = useState(() => Date.now() - 7 * 86400_000);
  const sent7d = logs?.filter((l) => Date.parse(l.createdAt) >= weekAgo).length ?? 0;
  const opened = logs?.filter((l) => l.status === "OPENED" || l.status === "CLICKED").length ?? 0;
  const clicked = logs?.filter((l) => l.status === "CLICKED").length ?? 0;
  const pct = (n: number) => (logs.length ? Math.round((n / logs.length) * 100) : 0);

  const marketingLogs = logs.filter((l) => MARKETING_TRIGGERS.has(l.trigger));

  const stats = [
    { icon: Send, label: "Sent (7 days)", value: sent7d.toLocaleString() },
    { icon: MailOpen, label: "Open rate", value: `${pct(opened)}%` },
    { icon: MousePointerClick, label: "Click rate", value: `${pct(clicked)}%` },
    { icon: ListChecks, label: "Active rules", value: rules?.filter((r) => r.active).length ?? 0 },
  ];

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Automation & reminders</h1>
        <p className="text-muted-foreground">
          Win back idle learners automatically over email & SMS. Rules are evaluated {sweepFrequency}.
        </p>
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

      <div>
        <h2 className="mb-3 text-lg font-bold">Automation rules</h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading rules…</p>
        ) : rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Automation rules have not been seeded yet. Run the database seed to create the five default rules.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                    <Switch checked={r.active} disabled={update.isPending} onCheckedChange={() => toggle(r)} />
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
                    <RuleSettingsEditor
                      key={`${r.id}-${r.cooldownHours}-${JSON.stringify(r.params)}`}
                      rule={r}
                      pending={update.isPending}
                      onSave={(input) =>
                        update.mutateAsync({
                          ...ruleToInput(r),
                          id: r.id,
                          cooldownHours: input.cooldownHours,
                          params: input.params,
                        } as UpsertAutomationRuleInput & { id: string })
                      }
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={activityTab === "recent" ? "secondary" : "outline"}
          onClick={() => setActivityTab("recent")}
        >
          Recent
        </Button>
        <Button
          size="sm"
          variant={activityTab === "marketing" ? "secondary" : "outline"}
          onClick={() => setActivityTab("marketing")}
        >
          Marketing
        </Button>
      </div>

      <Card className="p-0">
        <CardContent className="px-0 pt-0">
          <ReminderLogTable
            logs={activityTab === "recent" ? logs : marketingLogs}
            emptyMessage={
              activityTab === "recent"
                ? "No reminder activity yet."
                : `No marketing automation sends yet. Active rules are swept ${sweepFrequency}.`
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}

function requiredNumber(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function paramsFromStrings(
  trigger: ReminderTrigger,
  fields: Record<string, string>,
): UpsertAutomationRuleInput["params"] | null {
  switch (trigger) {
    case "IDLE": {
      const inactiveDays = requiredNumber(fields.inactiveDays);
      if (inactiveDays === null) return null;
      const parsed = idleParamsSchema.safeParse({ inactiveDays });
      return parsed.success ? parsed.data : null;
    }
    case "LOW_PROGRESS": {
      const enrolledDays = requiredNumber(fields.enrolledDays);
      const maxProgressPct = requiredNumber(fields.maxProgressPct);
      if (enrolledDays === null || maxProgressPct === null) return null;
      const parsed = lowProgressParamsSchema.safeParse({ enrolledDays, maxProgressPct });
      return parsed.success ? parsed.data : null;
    }
    case "ABANDONED_CART": {
      const pendingHours = requiredNumber(fields.pendingHours);
      if (pendingHours === null) return null;
      const parsed = abandonedCartParamsSchema.safeParse({ pendingHours });
      return parsed.success ? parsed.data : null;
    }
    case "ALMOST_DONE": {
      const minProgressPct = requiredNumber(fields.minProgressPct);
      if (minProgressPct === null) return null;
      const parsed = almostDoneParamsSchema.safeParse({ minProgressPct });
      return parsed.success ? parsed.data : null;
    }
    case "NEW_CONTENT": {
      const lookbackDays = requiredNumber(fields.lookbackDays);
      if (lookbackDays === null) return null;
      const parsed = newContentParamsSchema.safeParse({ lookbackDays });
      return parsed.success ? parsed.data : null;
    }
  }
}

function initialParamFields(rule: AutomationRuleDto): Record<string, string> {
  switch (rule.trigger) {
    case "IDLE":
      return { inactiveDays: String(rule.params.inactiveDays) };
    case "LOW_PROGRESS":
      return {
        enrolledDays: String(rule.params.enrolledDays),
        maxProgressPct: String(rule.params.maxProgressPct),
      };
    case "ABANDONED_CART":
      return { pendingHours: String(rule.params.pendingHours) };
    case "ALMOST_DONE":
      return { minProgressPct: String(rule.params.minProgressPct) };
    case "NEW_CONTENT":
      return { lookbackDays: String(rule.params.lookbackDays) };
  }
}

function RuleSettingsEditor({ rule, pending, onSave }: {
  rule: AutomationRuleDto;
  pending: boolean;
  onSave: (input: Pick<UpsertAutomationRuleInput, "cooldownHours" | "params">) => Promise<unknown>;
}) {
  const [cooldownHours, setCooldownHours] = useState(String(rule.cooldownHours));
  const [fields, setFields] = useState(() => initialParamFields(rule));
  const cooldownParsed = (() => {
    const hours = requiredNumber(cooldownHours);
    return hours === null ? { success: false as const } : automationCooldownHoursSchema.safeParse(hours);
  })();
  const paramsParsed = paramsFromStrings(rule.trigger, fields);
  const draft =
    cooldownParsed.success && paramsParsed
      ? upsertAutomationRuleSchema.safeParse({
          ...ruleToInput(rule),
          cooldownHours: cooldownParsed.data,
          params: paramsParsed,
        })
      : null;
  const unchanged =
    draft?.success &&
    draft.data.cooldownHours === rule.cooldownHours &&
    JSON.stringify(draft.data.params) === JSON.stringify(rule.params);

  function setField(key: string, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    if (!draft?.success || pending || unchanged) return;
    try {
      await onSave({ cooldownHours: draft.data.cooldownHours, params: draft.data.params });
      toast.success("Settings saved");
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  }

  const invalid = !draft?.success;

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <ParamFields trigger={rule.trigger} fields={fields} pending={pending} onChange={setField} />
      <div className="space-y-1.5">
        <Label htmlFor={`cooldown-${rule.id}`}>Cooldown (hours)</Label>
        <Input
          id={`cooldown-${rule.id}`}
          type="number"
          min={MIN_AUTOMATION_COOLDOWN_HOURS}
          max={MAX_AUTOMATION_COOLDOWN_HOURS}
          step={1}
          value={cooldownHours}
          onChange={(e) => setCooldownHours(e.target.value)}
          disabled={pending}
          aria-invalid={!cooldownParsed.success}
        />
        <p className="text-xs text-muted-foreground">
          Minimum hours between reminders from this rule to the same learner (24–8760).
        </p>
      </div>
      <Button type="button" onClick={save} disabled={pending || invalid || unchanged} className="w-full">
        Save settings
      </Button>
    </div>
  );
}

function ParamFields({ trigger, fields, pending, onChange }: {
  trigger: ReminderTrigger;
  fields: Record<string, string>;
  pending: boolean;
  onChange: (key: string, value: string) => void;
}) {
  const numInput = (key: string, label: string, step = 1) => (
    <div key={key} className="space-y-1.5">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type="number"
        step={step}
        value={fields[key] ?? ""}
        onChange={(e) => onChange(key, e.target.value)}
        disabled={pending}
      />
    </div>
  );

  switch (trigger) {
    case "IDLE":
      return numInput("inactiveDays", "Inactive for more than (days)");
    case "LOW_PROGRESS":
      return (
        <>
          {numInput("enrolledDays", "Enrolled for more than (days)")}
          {numInput("maxProgressPct", "Progress at most (%)")}
        </>
      );
    case "ABANDONED_CART":
      return numInput("pendingHours", "Order pending for more than (hours)", 0.25);
    case "ALMOST_DONE":
      return numInput("minProgressPct", "Progress at least (%)");
    case "NEW_CONTENT":
      return numInput("lookbackDays", "Lessons added within the last (days)");
  }
}

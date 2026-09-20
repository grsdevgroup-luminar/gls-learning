"use client";

import { useMemo, useState } from "react";
import type { EmailTemplateCategory, EmailTemplateDto } from "@skillstream/shared";
import { useEmailTemplates, useReminderLogs } from "@/lib/api/hooks";
import { relativeDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  KeyRound, Building2, ShoppingBag, UserCheck, Wallet, Megaphone,
  Search, Mail, AlertTriangle, Handshake,
} from "lucide-react";
import { EmailTemplateEditor } from "./email-template-editor";

const CATEGORY_META: Record<EmailTemplateCategory, { label: string; icon: typeof Mail }> = {
  auth: { label: "Auth & onboarding", icon: KeyRound },
  organizations: { label: "Organizations", icon: Building2 },
  delivery_partner: { label: "Delivery partner", icon: Handshake },
  commerce: { label: "Commerce", icon: ShoppingBag },
  applications: { label: "Applications", icon: UserCheck },
  payouts: { label: "Payouts", icon: Wallet },
  admin_alerts: { label: "Admin alerts", icon: Megaphone },
};
const CATEGORIES = Object.keys(CATEGORY_META) as EmailTemplateCategory[];

export default function EmailTemplatesClient() {
  const { data: templates = [], isLoading } = useEmailTemplates();
  const { data: logs = [] } = useReminderLogs();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<EmailTemplateCategory | "all">("all");
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const [weekAgo] = useState(() => Date.now() - 7 * 86400_000);
  const recentLogs = logs.filter((l) => Date.parse(l.createdAt) >= weekAgo);
  const sent7d = recentLogs.filter((l) => l.status !== "FAILED").length;
  const failed7d = recentLogs.filter((l) => l.status === "FAILED").length;
  const customizedCount = templates.filter((t) => t.isCustomized).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((t) => {
      if (category !== "all" && t.category !== category) return false;
      if (!q) return true;
      return (
        t.label.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.key.toLowerCase().includes(q)
      );
    });
  }, [templates, search, category]);

  const grouped = useMemo(() => {
    const byCategory = new Map<EmailTemplateCategory, EmailTemplateDto[]>();
    for (const t of filtered) {
      const list = byCategory.get(t.category) ?? [];
      list.push(t);
      byCategory.set(t.category, list);
    }
    return byCategory;
  }, [filtered]);

  const editing = templates.find((t) => t.key === editingKey) ?? null;

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Email templates</h1>
          <p className="text-muted-foreground">
            Customize the subject and copy of every email GRS Learning sends. Unedited templates
            use our default copy.
          </p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates…"
            className="pl-8"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Customized" value={customizedCount} />
        <StatCard label="Using default" value={templates.length - customizedCount} />
        <StatCard label="Sent (7 days)" value={sent7d} />
        <StatCard
          label="Failed (7 days)"
          value={failed7d}
          tone={failed7d > 0 ? "destructive" : undefined}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={category === "all" ? "secondary" : "outline"}
          onClick={() => setCategory("all")}
        >
          All
        </Button>
        {CATEGORIES.map((c) => (
          <Button
            key={c}
            size="sm"
            variant={category === c ? "secondary" : "outline"}
            onClick={() => setCategory(c)}
          >
            {CATEGORY_META[c].label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading templates…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No templates match your search.</p>
      ) : (
        <div className="space-y-6">
          {CATEGORIES.filter((c) => grouped.has(c)).map((c) => (
            <div key={c}>
              <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
                {CATEGORY_META[c].label}
              </h2>
              <div className="space-y-2">
                {grouped.get(c)!.map((t) => (
                  <TemplateRow key={t.key} template={t} onEdit={() => setEditingKey(t.key)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && <EmailTemplateEditor template={editing} onClose={() => setEditingKey(null)} />}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "destructive";
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className={`text-2xl font-bold leading-none ${tone === "destructive" && value > 0 ? "text-destructive" : ""}`}>
          {value.toLocaleString()}
        </div>
        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          {tone === "destructive" && value > 0 && <AlertTriangle className="h-3 w-3 text-destructive" />}
          {label}
        </div>
      </CardContent>
    </Card>
  );
}

function TemplateRow({ template, onEdit }: { template: EmailTemplateDto; onEdit: () => void }) {
  const Icon = CATEGORY_META[template.category].icon;
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3 py-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{template.label}</span>
            <Badge variant={template.isCustomized ? "default" : "outline"}>
              {template.isCustomized ? "Customized" : "Default"}
            </Badge>
          </div>
          <p className="truncate text-sm text-muted-foreground">{template.description}</p>
        </div>
        <div className="text-xs text-muted-foreground">
          {template.isCustomized && template.updatedAt
            ? `Edited ${relativeDate(template.updatedAt)}${template.updatedByName ? ` · ${template.updatedByName}` : ""}`
            : "Edited: —"}
        </div>
        <Button size="sm" variant="outline" onClick={onEdit}>
          Edit
        </Button>
      </CardContent>
    </Card>
  );
}

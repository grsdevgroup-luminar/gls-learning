"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  regionalPriceCents,
  formatLocal,
  type AdminPricingDto,
  type AdminRegionDto,
  type AdminTierDto,
} from "@skillstream/shared";
import { pricingAdminApi } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api/errors";
import { formatUsd } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Globe2, Layers, MapPin, Plus, Info, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const KEY = ["admin", "pricing"] as const;
const pct = (m: number) => `${Math.round(m * 100)}%`;

export default function AdminPricing() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: KEY, queryFn: pricingAdminApi.getAll });
  const [base, setBase] = useState("100");
  const baseNum = Number(base) || 0;

  // Every mutation returns the full pricing state — write it straight to cache.
  const apply = (next: AdminPricingDto) => qc.setQueryData(KEY, next);
  const onErr = (err: unknown) => toast.error(getApiErrorMessage(err));

  const saveTier = useMutation({
    mutationFn: ({ id, name, multiplier }: { id?: string; name: string; multiplier: number }) =>
      id ? pricingAdminApi.updateTier(id, { name, multiplier }) : pricingAdminApi.createTier({ name, multiplier }),
    onSuccess: (d) => { apply(d); toast.success("Tier saved"); },
    onError: onErr,
  });
  const deleteTier = useMutation({
    mutationFn: (id: string) => pricingAdminApi.deleteTier(id),
    onSuccess: (d) => { apply(d); toast.success("Tier deleted"); },
    onError: onErr,
  });
  const saveRegion = useMutation({
    mutationFn: ({ code, ...body }: { code: string } & Parameters<typeof pricingAdminApi.updateRegion>[1]) =>
      pricingAdminApi.updateRegion(code, body),
    onSuccess: (d) => { apply(d); toast.success("Region updated"); },
    onError: onErr,
  });

  if (isLoading || !data) return <div className="p-6 md:p-8 text-muted-foreground">Loading…</div>;
  const { tiers, regions } = data;

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Region &amp; custom pricing</h1>
          <p className="text-muted-foreground">Purchasing-power tiers and per-country pricing — applied to every course at checkout.</p>
        </div>
        <TierDialog
          trigger={<Button><Plus /> Add tier</Button>}
          onSave={(name, multiplier) => saveTier.mutate({ name, multiplier })}
          saving={saveTier.isPending}
        />
      </div>

      {/* Tiers */}
      <div className="grid gap-4 md:grid-cols-3">
        {tiers.map((t) => (
          <Card key={t.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Layers className="h-4 w-4 text-primary" /> {t.name}
                </CardTitle>
                <div className="flex gap-1">
                  <TierDialog
                    tier={t}
                    trigger={<Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>}
                    onSave={(name, multiplier) => saveTier.mutate({ id: t.id, name, multiplier })}
                    saving={saveTier.isPending}
                  />
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteTier.mutate(t.id)}
                    disabled={deleteTier.isPending}
                    aria-label="Delete tier"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <CardDescription>{t.countries.length} countries</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">{pct(t.multiplier)}</span>
                <span className="text-sm text-muted-foreground">of base price</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {t.countries.slice(0, 4).map((c) => <Badge key={c} variant="secondary" className="text-[10px]">{c}</Badge>)}
                {t.countries.length > 4 && <Badge variant="outline" className="text-[10px]">+{t.countries.length - 4}</Badge>}
                {t.countries.length === 0 && <span className="text-xs text-muted-foreground">No countries assigned</span>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Regions table — tier assignment + overrides live here */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4 text-primary" /> Countries</CardTitle>
          <CardDescription>Assign each country to a tier, or set a custom override that beats the tier.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Country</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Adjustment</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead className="pr-6 text-right">Edit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {regions.map((r) => (
                <TableRow key={r.code}>
                  <TableCell className="pl-6"><span className="mr-2">{r.flag}</span>{r.country}</TableCell>
                  <TableCell>
                    <Select
                      value={r.tierId ?? ""}
                      onValueChange={(tierId) => { if (tierId) saveRegion.mutate({ code: r.code, tierId }); }}
                    >
                      <SelectTrigger className="h-8 w-40"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                      <SelectContent>
                        {tiers.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <span className={r.multiplier < 1 ? "text-success" : "text-muted-foreground"}>
                      {r.multiplier < 1 ? `−${Math.round((1 - r.multiplier) * 100)}%` : "Full price"}
                    </span>
                    {r.override && <Badge variant="secondary" className="ml-2 text-[10px]">Custom</Badge>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.symbol} {r.currency}</TableCell>
                  <TableCell className="pr-6 text-right">
                    <RegionDialog
                      region={r}
                      trigger={<Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>}
                      onSave={(body) => saveRegion.mutate({ code: r.code, ...body })}
                      saving={saveRegion.isPending}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Live preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Globe2 className="h-4 w-4 text-primary" /> Price preview by region</CardTitle>
          <CardDescription className="flex items-center gap-2">
            <span>For a base price of</span>
            <span className="relative inline-flex w-28">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input value={base} onChange={(e) => setBase(e.target.value)} className="h-7 pl-6" inputMode="decimal" />
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Country</TableHead>
                <TableHead>Price (USD)</TableHead>
                <TableHead className="pr-6">Local display</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {regions.map((r) => {
                const usdCents = regionalPriceCents(Math.round(baseNum * 100), r);
                return (
                  <TableRow key={r.code}>
                    <TableCell className="pl-6"><span className="mr-2">{r.flag}</span>{r.country}</TableCell>
                    <TableCell className="font-medium">{formatUsd(usdCents / 100)}</TableCell>
                    <TableCell className="pr-6 text-muted-foreground">{r.code === "US" ? "—" : `≈ ${formatLocal(usdCents, r)}`}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5" /> A learner&apos;s region is detected at checkout and prices are server-enforced. Editing a tier re-prices every country in it instantly.
      </p>
    </div>
  );
}

function TierDialog({
  tier, trigger, onSave, saving,
}: {
  tier?: AdminTierDto;
  trigger: React.ReactNode;
  onSave: (name: string, multiplier: number) => void;
  saving: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(tier?.name ?? "");
  const [percent, setPercent] = useState(String(Math.round((tier?.multiplier ?? 1) * 100)));

  function save() {
    const p = Number(percent);
    if (!name.trim() || !Number.isFinite(p) || p < 1 || p > 200) {
      toast.error("Enter a name and a percentage between 1 and 200");
      return;
    }
    onSave(name.trim(), p / 100);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{tier ? "Edit tier" : "New tier"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tier 2 — Middle income" />
          </div>
          <div className="space-y-1">
            <Label>Price (% of base)</Label>
            <div className="relative w-32">
              <Input value={percent} onChange={(e) => setPercent(e.target.value)} inputMode="numeric" className="pr-7" />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
            </div>
            <p className="text-xs text-muted-foreground">100% = full price, 70% = 30% off.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RegionDialog({
  region, trigger, onSave, saving,
}: {
  region: AdminRegionDto;
  trigger: React.ReactNode;
  onSave: (body: { override?: boolean; multiplier?: number; fxRate?: number }) => void;
  saving: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [override, setOverride] = useState(region.override);
  const [percent, setPercent] = useState(String(Math.round(region.multiplier * 100)));
  const [fx, setFx] = useState(String(region.fxRate));

  function save() {
    const body: { override?: boolean; multiplier?: number; fxRate?: number } = {};
    const fxNum = Number(fx);
    if (Number.isFinite(fxNum) && fxNum > 0 && fxNum !== region.fxRate) body.fxRate = fxNum;
    if (override) {
      const p = Number(percent);
      if (!Number.isFinite(p) || p < 1 || p > 200) { toast.error("Custom % must be 1–200"); return; }
      body.multiplier = p / 100; // implies override on the server
    } else if (region.override) {
      body.override = false; // clearing an override resyncs to the tier
    }
    onSave(body);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{region.flag} {region.country}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
            Custom price (override the tier)
          </label>
          {override && (
            <div className="space-y-1">
              <Label>Price (% of base)</Label>
              <div className="relative w-32">
                <Input value={percent} onChange={(e) => setPercent(e.target.value)} inputMode="numeric" className="pr-7" />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
              </div>
            </div>
          )}
          <div className="space-y-1">
            <Label>FX rate (USD → {region.currency})</Label>
            <Input value={fx} onChange={(e) => setFx(e.target.value)} inputMode="decimal" className="w-32" />
            <p className="text-xs text-muted-foreground">Display only — checkout charges in USD.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

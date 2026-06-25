"use client";

import { useState } from "react";
import { pricingTiers, regions, countryOverrides, regionalUsd, formatLocal } from "@/lib/mock/pricing";
import { formatUsd } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Globe2, Layers, MapPin, Plus, Info } from "lucide-react";

export default function AdminPricing() {
  const [base, setBase] = useState("100");
  const baseNum = Number(base) || 0;

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Region & custom pricing</h1>
        <p className="text-muted-foreground">Purchasing-power tiers and per-country overrides — applied to every course automatically.</p>
      </div>

      {/* Tiers */}
      <div className="grid gap-4 md:grid-cols-3">
        {pricingTiers.map((t) => (
          <Card key={t.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Layers className="h-4 w-4 text-primary" /> {t.name}</CardTitle>
              <CardDescription>{t.countries.length} countries</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">{Math.round(t.multiplier * 100)}%</span>
                <span className="text-sm text-muted-foreground">of base price</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {t.countries.slice(0, 4).map((c) => <Badge key={c} variant="secondary" className="text-[10px]">{c}</Badge>)}
                {t.countries.length > 4 && <Badge variant="outline" className="text-[10px]">+{t.countries.length - 4}</Badge>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Custom overrides */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4 text-primary" /> Custom country overrides</CardTitle>
            <CardDescription>These take priority over the tier for a specific country.</CardDescription>
          </div>
          <Button size="sm" variant="outline"><Plus /> Add override</Button>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {countryOverrides.map((o) => (
            <div key={o.country} className="flex items-center gap-3 rounded-lg border p-3">
              <span className="text-2xl">{o.flag}</span>
              <div>
                <div className="text-sm font-medium">{o.country}</div>
                <div className="text-xs text-muted-foreground">Flat {o.flatPercent}% of base price</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Live preview table */}
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
                <TableHead>Tier</TableHead>
                <TableHead>Adjustment</TableHead>
                <TableHead>Price (USD)</TableHead>
                <TableHead className="pr-6">Local display</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {regions.map((r) => {
                const usd = regionalUsd(baseNum, r);
                return (
                  <TableRow key={r.code}>
                    <TableCell className="pl-6"><span className="mr-2">{r.flag}</span>{r.country}</TableCell>
                    <TableCell>{r.override ? <Badge variant="secondary">Custom</Badge> : <span className="text-sm text-muted-foreground">{pricingTiers.find((t) => t.id === r.tierId)?.name.split(" — ")[0]}</span>}</TableCell>
                    <TableCell><span className={r.multiplier < 1 ? "text-success" : "text-muted-foreground"}>{r.multiplier < 1 ? `−${Math.round((1 - r.multiplier) * 100)}%` : "Full price"}</span></TableCell>
                    <TableCell className="font-medium">{formatUsd(usd)}</TableCell>
                    <TableCell className="pr-6 text-muted-foreground">{r.code === "US" ? "—" : `≈ ${formatLocal(usd, r)}`}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5" /> In production, a learner's region is detected via geo-IP and prices are server-enforced; conversion rates refresh from a live FX feed.
      </p>
    </div>
  );
}

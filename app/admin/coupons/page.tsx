"use client";

import { useState } from "react";
import { coupons as seedCoupons } from "@/lib/mock/coupons";
import { Meter } from "@/components/shared/meter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Ticket, Plus, Copy, Percent, DollarSign, Gift } from "lucide-react";
import type { Coupon } from "@/types";
import { toast } from "sonner";

const typeIcon = { percent: Percent, fixed: DollarSign, free: Gift };

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>(seedCoupons);
  const [code, setCode] = useState("");
  const [type, setType] = useState<Coupon["type"]>("percent");
  const [value, setValue] = useState("20");

  function create() {
    if (!code.trim()) { toast.error("Enter a coupon code"); return; }
    const c: Coupon = {
      code: code.toUpperCase(), type, value: Number(value) || 0,
      description: `${type === "percent" ? value + "% off" : type === "fixed" ? "$" + value + " off" : "Free access"}`,
      scope: "global", expiresAt: "2026-12-31", usageLimit: 1000, used: 0, active: true,
    };
    setCoupons((x) => [c, ...x]);
    setCode("");
    toast.success(`Coupon ${c.code} created`);
  }

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Coupons & discounts</h1>
          <p className="text-muted-foreground">Create codes, run sales, and track redemptions.</p>
        </div>
        <Dialog>
          <DialogTrigger render={<Button />}><Plus /> New coupon</DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create a coupon</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5"><Label>Code</Label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="SUMMER25" className="uppercase" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={type} onValueChange={(v) => setType(v as Coupon["type"])}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Percentage</SelectItem>
                      <SelectItem value="fixed">Fixed amount</SelectItem>
                      <SelectItem value="free">Free</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{type === "percent" ? "Percent off" : type === "fixed" ? "Amount ($)" : "—"}</Label>
                  <Input value={value} onChange={(e) => setValue(e.target.value)} disabled={type === "free"} inputMode="numeric" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
              <DialogClose render={<Button onClick={create} />}>Create coupon</DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {coupons.map((c) => {
          const Icon = typeIcon[c.type];
          const expired = new Date(c.expiresAt) < new Date("2026-06-23") || !c.active;
          return (
            <Card key={c.code} className={expired ? "opacity-60" : ""}>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 font-mono text-base">
                  <Ticket className="h-4 w-4 text-primary" /> {c.code}
                </CardTitle>
                <Badge variant="outline" className={expired ? "text-muted-foreground" : "text-success"}>
                  {expired ? "Inactive" : "Active"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-2xl font-bold">
                  <Icon className="h-5 w-5 text-primary" />
                  {c.type === "percent" ? `${c.value}%` : c.type === "fixed" ? `$${c.value}` : "Free"}
                  <span className="text-sm font-normal text-muted-foreground">off</span>
                </div>
                <p className="text-sm text-muted-foreground">{c.description}</p>
                <div>
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>{c.used.toLocaleString()} / {c.usageLimit.toLocaleString()} used</span>
                    <span>{Math.round((c.used / c.usageLimit) * 100)}%</span>
                  </div>
                  <Meter value={(c.used / c.usageLimit) * 100} height={6} />
                </div>
                <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
                  <span>Expires {c.expiresAt}</span>
                  <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard?.writeText(c.code); toast.success("Code copied"); }}><Copy className="h-3.5 w-3.5" /> Copy</Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

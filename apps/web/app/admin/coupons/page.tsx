"use client";

import { useState } from "react";
import { couponStatus, type CouponStatus, type CouponType } from "@skillstream/shared";
import type { CouponDto } from "@/lib/api/endpoints";
import {
  useAdminCoupons,
  useDeleteCoupon,
  usePatchCoupon,
  useUpsertCoupon,
} from "@/lib/api/hooks";
import { getApiErrorMessage } from "@/lib/api/errors";
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
import { Ticket, Plus, Copy, Percent, DollarSign, Gift, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

const typeIcon: Record<CouponType, typeof Percent> = {
  PERCENT: Percent,
  FIXED: DollarSign,
  FREE: Gift,
};

const statusStyle: Record<CouponStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "text-success" },
  disabled: { label: "Disabled", className: "text-muted-foreground" },
  expired: { label: "Expired", className: "text-muted-foreground" },
  "limit-reached": { label: "Limit reached", className: "text-warning" },
};

/** PERCENT is 0-100, FIXED is cents, FREE ignores the value entirely. */
function offerLabel(c: CouponDto) {
  if (c.type === "PERCENT") return `${c.value}%`;
  if (c.type === "FIXED") return `$${(c.value / 100).toFixed(0)}`;
  return "Free";
}

export default function AdminCoupons() {
  const { data: coupons = [], isLoading } = useAdminCoupons();
  const upsert = useUpsertCoupon();
  const patch = usePatchCoupon();
  const remove = useDeleteCoupon();

  const [code, setCode] = useState("");
  const [type, setType] = useState<CouponType>("PERCENT");
  const [value, setValue] = useState("20");
  const [expiresAt, setExpiresAt] = useState("");
  const [usageLimit, setUsageLimit] = useState("0");

  function create() {
    if (!code.trim()) return toast.error("Enter a coupon code");
    if (!expiresAt) return toast.error("Pick an expiry date");
    const n = Number(value) || 0;
    if (type === "PERCENT" && (n <= 0 || n > 100))
      return toast.error("Percent must be between 1 and 100");

    upsert.mutate(
      {
        code: code.trim().toUpperCase(),
        type,
        // FIXED is stored in cents; the form collects whole dollars.
        value: type === "FIXED" ? Math.round(n * 100) : type === "FREE" ? 0 : n,
        description:
          type === "PERCENT" ? `${n}% off` : type === "FIXED" ? `$${n} off` : "Free access",
        scope: "GLOBAL",
        expiresAt: new Date(expiresAt).toISOString(),
        usageLimit: Number(usageLimit) || 0,
        active: true,
      },
      {
        onSuccess: (c) => {
          setCode("");
          toast.success(`Coupon ${c.code} created`);
        },
        onError: (e) => toast.error(getApiErrorMessage(e)),
      },
    );
  }

  const act = (input: Parameters<typeof patch.mutate>[0], msg: string) =>
    patch.mutate(input, {
      onSuccess: () => toast.success(msg),
      onError: (e) => toast.error(getApiErrorMessage(e)),
    });

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Coupons & discounts</h1>
          <p className="text-muted-foreground">
            Create codes, run sales, and track redemptions. Promoting a coupon shows it in
            the storefront banner — only one can be promoted at a time.
          </p>
        </div>
        <Dialog>
          <DialogTrigger render={<Button />}><Plus /> New coupon</DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create a coupon</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Code</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="SUMMER25" className="uppercase" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={type} onValueChange={(v) => setType(v as CouponType)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERCENT">Percentage</SelectItem>
                      <SelectItem value="FIXED">Fixed amount</SelectItem>
                      <SelectItem value="FREE">Free</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{type === "PERCENT" ? "Percent off" : type === "FIXED" ? "Amount ($)" : "—"}</Label>
                  <Input value={value} onChange={(e) => setValue(e.target.value)} disabled={type === "FREE"} inputMode="numeric" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Expires</Label>
                  <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Usage limit</Label>
                  <Input value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} inputMode="numeric" placeholder="0 = unlimited" />
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

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading coupons…</p>
      ) : coupons.length === 0 ? (
        <p className="text-sm text-muted-foreground">No coupons yet. Create one to get started.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {coupons.map((c) => {
            const Icon = typeIcon[c.type];
            const status = couponStatus(c);
            const style = statusStyle[status];
            const unlimited = c.usageLimit === 0;
            const usedPct = unlimited ? 0 : Math.round((c.used / c.usageLimit) * 100);

            return (
              <Card key={c.code} className={status === "active" ? "" : "opacity-60"}>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2 font-mono text-base">
                    <Ticket className="h-4 w-4 text-primary" /> {c.code}
                  </CardTitle>
                  <div className="flex items-center gap-1.5">
                    {c.featured && (
                      <Badge variant="outline" className="text-primary">Promoted</Badge>
                    )}
                    <Badge variant="outline" className={style.className}>{style.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-2xl font-bold">
                    <Icon className="h-5 w-5 text-primary" />
                    {offerLabel(c)}
                    <span className="text-sm font-normal text-muted-foreground">off</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{c.description}</p>
                  <div>
                    <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                      <span>
                        {c.used.toLocaleString()} {unlimited ? "used" : `/ ${c.usageLimit.toLocaleString()} used`}
                      </span>
                      <span>{unlimited ? "Unlimited" : `${usedPct}%`}</span>
                    </div>
                    <Meter value={usedPct} height={6} />
                  </div>
                  <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
                    <span>Expires {c.expiresAt.slice(0, 10)}</span>
                    <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard?.writeText(c.code); toast.success("Code copied"); }}>
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => act({ code: c.code, active: !c.active }, c.active ? "Coupon disabled" : "Coupon enabled")}
                    >
                      {c.active ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      size="sm"
                      variant={c.featured ? "secondary" : "outline"}
                      onClick={() => act({ code: c.code, featured: !c.featured }, c.featured ? "Removed from banner" : "Promoted to banner")}
                    >
                      <Star className="h-3.5 w-3.5" /> {c.featured ? "Unpromote" : "Promote"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() =>
                        remove.mutate(c.code, {
                          onSuccess: () => toast.success(`Coupon ${c.code} deleted`),
                          onError: (e) => toast.error(getApiErrorMessage(e)),
                        })
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

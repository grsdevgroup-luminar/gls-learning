"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/context/store";
import { getCourseById } from "@/lib/mock/courses";
import { regionalUsd, formatLocal } from "@/lib/mock/pricing";
import { validateCoupon, discountAmount } from "@/lib/mock/coupons";
import { formatUsd } from "@/lib/format";
import { RegionSelect } from "@/components/shared/region-select";
import { CourseArt } from "@/components/shared/course-art";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Lock, CreditCard, ShieldCheck, Check, Loader2, Globe2,
} from "lucide-react";

const methods = [
  { id: "stripe", label: "Credit / debit card", sub: "Visa, Mastercard, Amex", icon: CreditCard },
  { id: "paypal", label: "PayPal", sub: "Pay with your PayPal balance", icon: WalletIcon },
];

export default function CheckoutPage() {
  const { cart, region, coupon, enroll, clearCart, mounted } = useStore();
  const router = useRouter();
  const [method, setMethod] = useState("stripe");
  const [processing, setProcessing] = useState(false);

  const items = useMemo(
    () => cart.map((id) => getCourseById(id)).filter(Boolean) as NonNullable<ReturnType<typeof getCourseById>>[],
    [cart],
  );
  const subtotal = items.reduce((s, c) => s + regionalUsd(c.basePrice, region), 0);
  const couponResult = coupon ? validateCoupon(coupon, subtotal, cart) : null;
  const discount = couponResult?.ok && couponResult.coupon ? discountAmount(couponResult.coupon, subtotal) : 0;
  const total = Math.max(0, subtotal - discount);

  function pay() {
    setProcessing(true);
    setTimeout(() => {
      enroll(cart);
      clearCart();
      router.push("/checkout/success");
    }, 1600);
  }

  if (!mounted) return <div className="mx-auto max-w-7xl px-4 py-16" />;

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">Nothing to check out</h1>
        <p className="mt-2 text-muted-foreground">Your cart is empty.</p>
        <Button className="mt-6" render={<Link href="/courses" />}>Browse courses</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-8 text-3xl font-bold tracking-tight">Checkout</h1>
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        {/* Left: billing + payment */}
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Billing details</h2>
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Globe2 className="h-4 w-4" /> <RegionSelect className="w-44" />
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" placeholder="Alex Morgan" />
                <Field label="Email" placeholder="you@example.com" type="email" />
                <Field label="Country" value={region.country} readOnly />
                <Field label="ZIP / Postal code" placeholder="10001" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 pt-6">
              <h2 className="font-semibold">Payment method</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {methods.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMethod(m.id)}
                    className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                      method === m.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50"
                    }`}
                  >
                    <m.icon className="h-5 w-5" />
                    <div>
                      <div className="text-sm font-medium">{m.label}</div>
                      <div className="text-xs text-muted-foreground">{m.sub}</div>
                    </div>
                    {method === m.id && <Check className="ml-auto h-4 w-4 text-primary" />}
                  </button>
                ))}
              </div>

              {method === "stripe" ? (
                <div className="grid gap-4">
                  <Field label="Card number" placeholder="4242 4242 4242 4242" icon={<CreditCard className="h-4 w-4" />} />
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Expiry" placeholder="MM / YY" />
                    <Field label="CVC" placeholder="123" />
                  </div>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Lock className="h-3.5 w-3.5" /> Payments are encrypted. This is a demo — no card is charged.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  You'll be redirected to PayPal to complete your purchase. (Simulated)
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: order summary */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <h2 className="font-semibold">Order summary</h2>
              <div className="space-y-3">
                {items.map((c) => (
                  <div key={c.id} className="flex items-center gap-3">
                    <CourseArt seed={c.thumbnail} title={c.title} className="h-12 w-16 shrink-0 rounded-md" iconSize={18} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{c.title}</div>
                    </div>
                    <div className="text-sm font-semibold">{formatUsd(regionalUsd(c.basePrice, region))}</div>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatUsd(subtotal)}</span></div>
                {discount > 0 && (
                  <div className="flex justify-between text-success">
                    <span className="flex items-center gap-1"><Badge variant="secondary" className="text-success">{coupon}</Badge></span>
                    <span>-{formatUsd(discount)}</span>
                  </div>
                )}
                <Separator className="my-2" />
                <div className="flex justify-between text-lg font-bold"><span>Total</span><span>{formatUsd(total)}</span></div>
                {region.code !== "US" && (
                  <div className="text-right text-xs text-muted-foreground">
                    ≈ {formatLocal(total, region)} · charged in USD
                  </div>
                )}
              </div>

              <Button className="w-full" size="lg" onClick={pay} disabled={processing}>
                {processing ? <><Loader2 className="animate-spin" /> Processing…</> : <><Lock /> Pay {formatUsd(total)}</>}
              </Button>
              <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" /> 30-day money-back guarantee
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, placeholder, type = "text", value, readOnly, icon,
}: { label: string; placeholder?: string; type?: string; value?: string; readOnly?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="relative">
        {icon && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>}
        <Input placeholder={placeholder} type={type} defaultValue={value} readOnly={readOnly} className={icon ? "pl-8" : ""} />
      </div>
    </div>
  );
}

function WalletIcon(props: React.ComponentProps<"svg">) {
  return <CreditCard {...props} />;
}

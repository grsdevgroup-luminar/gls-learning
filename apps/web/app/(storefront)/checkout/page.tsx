"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { MAX_PAGE_SIZE } from "@skillstream/shared";
import { useStore } from "@/lib/context/store";
import { api } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useSession } from "@/lib/api/session";
import { formatLocal } from "@/lib/pricing";
import { getReferralCode, clearReferralCode } from "@/lib/referral";
import { formatUsd } from "@/lib/format";
import { toast } from "sonner";
import { RegionSelect } from "@/components/shared/region-select";
import { CourseArt } from "@/components/shared/course-art";
import { Reveal, Stagger, StaggerItem, Magnetic } from "@/components/shared/motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Lock, CreditCard, ShieldCheck, Check, Loader2, Globe2, ShoppingCart,
  ChevronRight, Wallet, BadgeCheck, Infinity as InfinityIcon, Award, ArrowLeft,
} from "lucide-react";

const methods = [
  { id: "stripe", label: "Credit / debit card", sub: "Visa, Mastercard, Amex", icon: CreditCard },
  { id: "paypal", label: "PayPal", sub: "Pay with your PayPal balance", icon: Wallet },
];

const perks = [
  { icon: InfinityIcon, label: "Lifetime access on any device" },
  { icon: Award, label: "Certificate of completion" },
  { icon: ShieldCheck, label: "30-day money-back guarantee" },
];

export default function CheckoutPage() {
  const { cart, region, regionCode, coupon, clearCart, mounted } = useStore();
  const { user } = useSession();
  const router = useRouter();
  const [method, setMethod] = useState("stripe");
  const [processing, setProcessing] = useState(false);

  const { data: catalog } = useQuery({
    queryKey: ["store", "courses"],
    queryFn: () => api.courses({ pageSize: MAX_PAGE_SIZE }),
    staleTime: 60_000,
  });
  const items = useMemo(
    () =>
      cart
        .map((id) => catalog?.items.find((c) => c.id === id))
        .filter(Boolean) as NonNullable<typeof catalog>["items"],
    [cart, catalog],
  );

  // Authoritative totals come from the server quote (PPP + coupon recomputed there).
  const { data: quote } = useQuery({
    queryKey: ["quote", cart.join(","), coupon ?? "", regionCode],
    queryFn: () =>
      api.quote({ courseIds: cart, couponCode: coupon ?? undefined, regionCode }),
    enabled: mounted && cart.length > 0,
  });
  const lineUsd = (courseId: string) => {
    const line = quote?.lines.find((l) => l.courseId === courseId);
    if (line) return line.priceCents / 100;
    const c = items.find((i) => i.id === courseId);
    return c ? c.basePriceCents / 100 : 0;
  };
  const subtotal = (quote?.subtotalCents ?? 0) / 100;
  const discount = (quote?.discountCents ?? 0) / 100;
  const total = (quote?.totalCents ?? 0) / 100;

  async function pay() {
    if (!user) {
      router.push("/login?next=/checkout");
      return;
    }
    setProcessing(true);
    try {
      const session = await api.checkoutSession({
        courseIds: cart,
        couponCode: coupon ?? undefined,
        regionCode,
        gateway: method === "paypal" ? "PAYPAL" : "STRIPE",
        referralCode: getReferralCode() ?? undefined,
      });
      clearReferralCode();
      // Real gateway configured → hand off to Stripe/PayPal hosted checkout.
      if (session.redirectUrl && !session.devSimulateToken) {
        clearCart();
        window.location.assign(session.redirectUrl);
        return;
      }
      // Dev environment without gateway credentials → simulate the payment.
      if (session.devSimulateToken) {
        await api.devSimulatePayment(session.orderId);
      }
      clearCart();
      router.push(`/checkout/success?order=${session.orderId}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
      setProcessing(false);
    }
  }

  if (!mounted) return <div className="mx-auto max-w-7xl px-4 py-16" />;

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-muted">
          <ShoppingCart className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold">Nothing to check out</h1>
        <p className="mt-2 text-muted-foreground">Your cart is empty.</p>
        <Button className="mt-6" render={<Link href="/courses" />}>Browse courses</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {/* Header: back link + step indicator */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/cart" className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to cart
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Checkout</h1>
        </div>
        <Steps />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        {/* Left: billing + payment */}
        <div className="space-y-6">
          <Reveal y={20}>
            <Card variant="elevated">
              <CardContent className="space-y-4 pt-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="icon-tile grid size-9 place-items-center" style={{ ["--tile" as string]: "var(--tint-sky)" }}>
                      <Globe2 className="size-4" />
                    </span>
                    <div>
                      <h2 className="font-semibold leading-tight">Billing region</h2>
                      <p className="text-xs text-muted-foreground">{region.country} · {region.currency}</p>
                    </div>
                  </div>
                  <RegionSelect className="w-40 shrink-0" />
                </div>
                <Separator />
                <p className="text-sm text-muted-foreground">
                  Pricing is adjusted for your region. Your name, email and billing
                  address are collected securely by the payment provider on the next
                  step — we never see or store them.
                </p>
              </CardContent>
            </Card>
          </Reveal>

          <Reveal y={20} delay={0.06}>
            <Card variant="elevated">
              <CardContent className="space-y-4 pt-6">
                <div className="flex items-center gap-3">
                  <span className="icon-tile grid size-9 place-items-center" style={{ ["--tile" as string]: "var(--tint-violet)" }}>
                    <CreditCard className="size-4" />
                  </span>
                  <div>
                    <h2 className="font-semibold leading-tight">Payment method</h2>
                    <p className="text-xs text-muted-foreground">Choose how you&apos;d like to pay</p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {methods.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setMethod(m.id)}
                      className={`relative flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all duration-200 ${
                        method === m.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:-translate-y-0.5 hover:border-primary/30 hover:bg-muted/50"
                      }`}
                    >
                      <span
                        className="icon-tile grid size-9 shrink-0 place-items-center"
                        style={{ ["--tile" as string]: method === m.id ? "var(--primary)" : "var(--muted-foreground)" }}
                      >
                        <m.icon className="size-4" />
                      </span>
                      <div>
                        <div className="text-sm font-medium">{m.label}</div>
                        <div className="text-xs text-muted-foreground">{m.sub}</div>
                      </div>
                      {method === m.id && (
                        <span className="absolute right-3 top-3 grid size-5 animate-in place-items-center rounded-full bg-primary text-primary-foreground zoom-in-50 duration-200">
                          <Check className="size-3" />
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="animate-in rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground fade-in zoom-in-95 duration-200">
                  {method === "stripe"
                    ? "You'll be redirected to Stripe's secure checkout to enter your card."
                    : "You'll be redirected to PayPal to complete your purchase."}
                </div>

                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Lock className="h-3.5 w-3.5 shrink-0" /> Card details are entered on the provider&apos;s PCI-compliant page — never on SkillStream.
                </p>
              </CardContent>
            </Card>
          </Reveal>

          {/* Trust strip */}
          <Stagger className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-border bg-muted/30 px-5 py-4" gap={0.06}>
            {perks.map((p) => (
              <StaggerItem key={p.label} y={8} className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <p.icon className="h-4 w-4 text-primary" /> {p.label}
              </StaggerItem>
            ))}
          </Stagger>
        </div>

        {/* Right: order summary */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Reveal y={20} delay={0.1}>
            <Card variant="elevated" className="overflow-visible">
              <CardContent className="space-y-4 pt-6">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">Order summary</h2>
                  <Badge variant="secondary">{items.length} course{items.length !== 1 && "s"}</Badge>
                </div>
                <div className="space-y-3">
                  {items.map((c) => (
                    <div key={c.id} className="flex items-center gap-3">
                      <CourseArt seed={c.thumbnail} title={c.title} className="h-12 w-16 shrink-0 rounded-md" iconSize={18} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{c.title}</div>
                      </div>
                      <div className="text-sm font-semibold">{formatUsd(lineUsd(c.id))}</div>
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

                <Magnetic strength={0.12} className="flex w-full">
                  <Button className="sheen w-full" size="lg" onClick={pay} disabled={processing}>
                    {processing ? <><Loader2 className="animate-spin" /> Processing…</> : <><Lock /> Pay {formatUsd(total)}</>}
                  </Button>
                </Magnetic>
                <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
                  <BadgeCheck className="h-3.5 w-3.5 text-success" /> 30-day money-back guarantee
                </p>
              </CardContent>
            </Card>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

function Steps() {
  const steps = [
    { label: "Cart", done: true },
    { label: "Checkout", done: false, active: true },
    { label: "Confirmation", done: false },
  ];
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium">
      {steps.map((s, i) => (
        <span key={s.label} className="flex items-center gap-1.5">
          <span
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
              s.active
                ? "bg-primary text-primary-foreground"
                : s.done
                  ? "text-success"
                  : "text-muted-foreground"
            }`}
          >
            {s.done && <Check className="size-3" />}
            {s.label}
          </span>
          {i < steps.length - 1 && <ChevronRight className="size-3.5 text-muted-foreground" />}
        </span>
      ))}
    </div>
  );
}


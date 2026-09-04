"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@/lib/context/store";
import { useCatalog, useFeaturedCoupon } from "@/lib/api/hooks";
import { api } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api/errors";
import { formatLocal } from "@/lib/pricing";
import { formatUsd } from "@/lib/format";
import { CourseArt } from "@/components/shared/course-art";
import { Stars } from "@/components/shared/stars";
import { BestsellerBadge } from "@/components/shared/bestseller-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Trash2, Tag, ShoppingCart, ArrowRight, Check, Wallet } from "lucide-react";
import { toast } from "sonner";

export default function CartPage() {
  const { cart, removeFromCart, region, regionCode, coupon, setCoupon, mounted } = useStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [applying, setApplying] = useState(false);
  const [applyCredit, setApplyCredit] = useState(false);

  // Show the "Payment canceled" toast at most once per page load, and strip
  // `?canceled=` from the URL synchronously so a browser refresh doesn't
  // re-trigger the toast. `router.replace` alone is async — a refresh (or
  // Strict Mode's double-invoke in dev) can fire the toast a second time
  // before the URL update commits, which the user observes as the toast
  // re-appearing on every refresh.
  const canceledToastFiredRef = useRef(false);
  useEffect(() => {
    if (canceledToastFiredRef.current) return;
    const canceledOrder = searchParams.get("canceled");
    if (!canceledOrder) return;
    canceledToastFiredRef.current = true;

    // The provider has already created a server-side order by this point.
    // Reconcile its status before the student can return to Billing so an
    // abandoned checkout is never left showing as an active Pending purchase.
    void api.cancelOrder(canceledOrder).catch(() => undefined).finally(() => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
    });

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("canceled");
      window.history.replaceState(null, "", url.pathname + (url.search ? url.search : ""));
    }

    toast.error("Payment canceled", {
      description: "Your order was not completed. You can try again anytime.",
    });
  }, [queryClient, searchParams]);

  const { data: catalog } = useCatalog();
  const items = useMemo(
    () =>
      cart
        ?.map((id) => catalog?.items?.find((c) => c.id === id))
        .filter(Boolean) as NonNullable<typeof catalog>["items"],
    [cart, catalog],
  );

  const { data: featured } = useFeaturedCoupon();

  // Server-authoritative pricing: regional adjustment + coupon + credit.
  const { data: quote } = useQuery({
    queryKey: ["quote", cart.join(","), coupon ?? "", regionCode, applyCredit],
    queryFn: () =>
      api.quote({
        courseIds: cart,
        couponCode: coupon ?? undefined,
        regionCode,
        applyCredit,
      }),
    enabled: mounted && cart.length > 0,
  });

  const lineUsd = (courseId: string) => {
    const line = quote?.lines.find((l) => l.courseId === courseId);
    if (line) return line.priceCents / 100;
    const c = items?.find((i) => i.id === courseId);
    return c ? c.basePriceCents / 100 : 0;
  };
  const fallbackSubtotalCents = items?.reduce((sum, c) => sum + c.basePriceCents, 0) ?? 0;
  const subtotalCents = quote?.subtotalCents ?? fallbackSubtotalCents;
  const discountCents = quote?.discountCents ?? 0;
  const creditAppliedCents = quote?.creditAppliedCents ?? 0;
  const availableCreditCents = quote?.availableCreditCents ?? 0;
  const totalCents = quote?.totalCents ?? Math.max(0, subtotalCents - discountCents - creditAppliedCents);
  const subtotal = subtotalCents / 100;
  const discount = discountCents / 100;
  const creditApplied = creditAppliedCents / 100;
  const total = totalCents / 100;
  const originalTotal = items?.reduce(
    (sum, c) => sum + (c.originalPriceCents ?? c.basePriceCents) / 100,
    0,
  ) ?? 0;
  const couponValid = !!quote?.coupon?.valid;

  async function apply() {
    if (!code.trim() || cart.length === 0) return;
    setApplying(true);
    try {
      const res = await api.quote({
        courseIds: cart,
        couponCode: code.trim().toUpperCase(),
        regionCode,
        applyCredit,
      });
      if (res.coupon?.valid) {
        setCoupon(res.coupon.code);
        setCode("");
        toast.success(`Coupon applied: ${res.coupon.code}`, { description: res.coupon.message });
      } else {
        toast.error(res.coupon?.message ?? "This coupon can't be applied");
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setApplying(false);
    }
  }

  if (!mounted) return <div className="mx-auto max-w-7xl px-4 py-16" />;

  if (cart.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-muted">
          <ShoppingCart className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold">Your cart is empty</h1>
        <p className="mt-2 text-muted-foreground">Browse our catalog and find your next skill.</p>
        <Button className="mt-6" render={<Link href="/courses" />}>
          Explore courses <ArrowRight />
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="mb-1 text-3xl font-bold tracking-tight">Shopping cart</h1>
      <p className="mb-8 text-muted-foreground">{items.length} course{items.length !== 1 && "s"} in your cart</p>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {items?.map((c) => {
            const price = lineUsd(c.id);
            const original = c.originalPriceCents ? c.originalPriceCents / 100 : undefined;
            return (
              <Card key={c.id} className="p-0">
                <CardContent className="flex gap-4 p-4">
                  <CourseArt seed={c.thumbnail} title={c.title} className="h-20 w-32 shrink-0 rounded-lg" iconSize={28} />
                  <div className="flex flex-1 flex-col">
                    <Link href={`/courses/${c.slug}`} className="font-semibold leading-snug hover:text-primary">
                      {c.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">{c.instructor.name}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs">
                      <Stars rating={c.ratingAvg} size={12} showValue />
                      {c.bestseller && <BestsellerBadge />}
                    </div>
                    <button
                      onClick={() => { removeFromCart(c.id); toast("Removed from cart"); }}
                      className="mt-auto inline-flex w-fit items-center gap-1 text-xs text-destructive hover:underline"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </button>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{formatUsd(price)}</div>
                    {original && original > price && (
                      <div className="text-xs text-muted-foreground line-through">{formatUsd(original)}</div>
                    )}
                    {region.code !== "US" && (
                      <div className="text-[11px] text-muted-foreground">≈ {formatLocal(price, region)}</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Summary */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <p className="rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">
                {region.multiplier < 1
                  ? `Regional pricing applied — ${Math.round((1 - region.multiplier) * 100)}% off for ${region.country}.`
                  : `Standard global pricing applied for ${region.country}.`}
              </p>

              <Separator />

              <div id="coupon" className="scroll-mt-24 space-y-2">
              {/* Coupon */}
              {coupon ? (
                <div className="flex items-center justify-between rounded-md border border-success/30 bg-success/10 p-2.5 text-sm">
                  <span className="flex items-center gap-1.5 font-medium text-success">
                    <Check className="h-4 w-4" /> {coupon}
                  </span>
                  <button onClick={() => setCoupon(null)} className="text-xs text-muted-foreground hover:text-foreground">
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="Coupon code"
                      className="pl-8 uppercase"
                      onKeyDown={(e) => e.key === "Enter" && apply()}
                    />
                  </div>
                  <Button variant="outline" onClick={apply} disabled={applying}>
                    {applying ? "Checking…" : "Apply"}
                  </Button>
                </div>
              )}
              {/* The suggestion is whatever the admin has featured right now —
                  it used to be two hardcoded codes that may not exist. */}
              {featured && !coupon && (
                <p className="text-xs text-muted-foreground">
                  Try{" "}
                  <button
                    onClick={() => setCode(featured.code)}
                    className="font-mono font-medium text-primary"
                  >
                    {featured.code}
                  </button>
                </p>
              )}

              </div>

              <Separator />

              {availableCreditCents > 0 && (
                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-2.5 text-sm hover:bg-muted/40">
                  <input
                    type="checkbox"
                    checked={applyCredit}
                    onChange={(e) => setApplyCredit(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-primary"
                  />
                  <span className="flex flex-1 items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5">
                      <Wallet className="h-4 w-4 text-primary" />
                      Use store credit
                    </span>
                    <span className="font-medium">
                      {formatUsd(availableCreditCents / 100)} available
                    </span>
                  </span>
                </label>
              )}

              <div className="space-y-1.5 text-sm">
                <Row label="Original price" value={formatUsd(originalTotal)} muted strike />
                <Row label="Subtotal" value={formatUsd(subtotal)} />
                {discount > 0 && <Row label="Discount" value={`-${formatUsd(discount)}`} success />}
                {creditApplied > 0 && <Row label="Store credit" value={`-${formatUsd(creditApplied)}`} success />}
                <Separator className="my-2" />
                <div className="flex items-center justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{formatUsd(total)}</span>
                </div>
                {region.code !== "US" && (
                  <div className="text-right text-xs text-muted-foreground">≈ {formatLocal(total, region)}</div>
                )}
              </div>

              <Button className="w-full" size="lg" onClick={() => router.push("/checkout")}>
                Checkout <ArrowRight />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, muted, strike, success }: { label: string; value: string; muted?: boolean; strike?: boolean; success?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${muted ? "text-muted-foreground" : ""} ${success ? "text-success" : ""}`}>
      <span>{label}</span>
      <span className={strike ? "line-through" : ""}>{value}</span>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/context/store";
import { getCourseById } from "@/lib/mock/courses";
import { getInstructor } from "@/lib/mock/instructors";
import { regionalUsd, formatLocal } from "@/lib/mock/pricing";
import { validateCoupon, discountAmount } from "@/lib/mock/coupons";
import { formatUsd } from "@/lib/format";
import { CourseArt } from "@/components/shared/course-art";
import { Stars } from "@/components/shared/stars";
import { RegionSelect } from "@/components/shared/region-select";
import { BestsellerBadge } from "@/components/shared/bestseller-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Trash2, Tag, ShoppingCart, ArrowRight, Check, Globe2 } from "lucide-react";
import { toast } from "sonner";

export default function CartPage() {
  const { cart, removeFromCart, region, coupon, setCoupon, mounted } = useStore();
  const router = useRouter();
  const [code, setCode] = useState("");

  const items = useMemo(
    () => cart.map((id) => getCourseById(id)).filter(Boolean) as NonNullable<ReturnType<typeof getCourseById>>[],
    [cart],
  );
  const subtotal = items.reduce((sum, c) => sum + regionalUsd(c.basePrice, region), 0);
  const originalTotal = items.reduce((sum, c) => sum + (c.originalPrice ?? c.basePrice), 0);

  const couponResult = coupon
    ? validateCoupon(coupon, subtotal, cart)
    : null;
  const discount =
    couponResult?.ok && couponResult.coupon ? discountAmount(couponResult.coupon, subtotal) : 0;
  const total = Math.max(0, subtotal - discount);

  function apply() {
    const res = validateCoupon(code, subtotal, cart);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    setCoupon(res.coupon!.code);
    setCode("");
    toast.success(`Coupon applied: ${res.coupon!.code}`, { description: res.message });
  }

  if (!mounted) return <div className="mx-auto max-w-7xl px-4 py-16" />;

  if (items.length === 0) {
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
          {items.map((c) => {
            const instructor = getInstructor(c.instructorId);
            const price = regionalUsd(c.basePrice, region);
            return (
              <Card key={c.id} className="p-0">
                <CardContent className="flex gap-4 p-4">
                  <CourseArt seed={c.thumbnail} title={c.title} className="h-20 w-32 shrink-0 rounded-lg" iconSize={28} />
                  <div className="flex flex-1 flex-col">
                    <Link href={`/courses/${c.slug}`} className="font-semibold leading-snug hover:text-primary">
                      {c.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">{instructor?.name}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs">
                      <Stars rating={c.rating} size={12} showValue />
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
                    {c.originalPrice && c.originalPrice > price && (
                      <div className="text-xs text-muted-foreground line-through">{formatUsd(c.originalPrice)}</div>
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
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Globe2 className="h-4 w-4" /> Pricing region
                </span>
                <RegionSelect className="w-40" />
              </div>
              <p className="rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">
                {region.multiplier < 1
                  ? `Regional pricing applied — ${Math.round((1 - region.multiplier) * 100)}% off for ${region.country}.`
                  : "Standard global pricing for your region."}
              </p>

              <Separator />

              {/* Coupon */}
              {couponResult?.ok ? (
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
                  <Button variant="outline" onClick={apply}>Apply</Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">Try <button onClick={() => setCode("LAUNCH40")} className="font-mono font-medium text-primary">LAUNCH40</button> or <button onClick={() => setCode("WELCOME10")} className="font-mono font-medium text-primary">WELCOME10</button></p>

              <Separator />

              <div className="space-y-1.5 text-sm">
                <Row label="Original price" value={formatUsd(originalTotal)} muted strike />
                <Row label="Subtotal" value={formatUsd(subtotal)} />
                {discount > 0 && <Row label="Discount" value={`-${formatUsd(discount)}`} success />}
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

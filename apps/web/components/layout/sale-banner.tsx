"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Tag } from "lucide-react";
import type { CouponType } from "@skillstream/shared";
import { useFeaturedCoupon } from "@/lib/api/hooks";

/** Ticks once a second toward `iso`, or null until mounted so the server and
 *  client don't render two different clocks. */
function useCountdown(iso: string) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    // First tick is scheduled (not run synchronously) so the effect body
    // only subscribes to the clock instead of setting state directly.
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);
  if (now === null) return null;
  const diff = Math.max(0, Date.parse(iso) - now);
  return {
    d: Math.floor(diff / 86400000),
    h: Math.floor((diff % 86400000) / 3600000),
    m: Math.floor((diff % 3600000) / 60000),
    s: Math.floor((diff % 60000) / 1000),
  };
}

const offerLabel = (type: CouponType, value: number) =>
  type === "PERCENT"
    ? `${value}% off`
    : type === "FIXED"
      ? `$${(value / 100).toFixed(0)} off`
      : "Free access";

export function SaleBanner() {
  const { data: coupon } = useFeaturedCoupon();
  const left = useCountdown(coupon?.expiresAt ?? "");
  const pad = (n: number) => n.toString().padStart(2, "0");

  // No promoted coupon (or it lapsed) — the banner disappears entirely.
  if (!coupon) return null;

  return (
    <Link
      href="/courses"
      className="block brand-gradient text-center text-sm text-white"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <Tag className="h-4 w-4" />
          {coupon.description || offerLabel(coupon.type, coupon.value)}
        </span>
        <span className="opacity-90">Use code</span>
        <span className="rounded bg-white/25 px-1.5 py-0.5 font-mono font-semibold">
          {coupon.code}
        </span>
        {left && (
          <span className="tabular-nums opacity-90">
            ends in{" "}
            {left.d > 0
              ? `${left.d}d ${pad(left.h)}:${pad(left.m)}:${pad(left.s)}`
              : `${pad(left.h)}:${pad(left.m)}:${pad(left.s)}`}
          </span>
        )}
      </div>
    </Link>
  );
}

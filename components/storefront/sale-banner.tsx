"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Tag } from "lucide-react";

function useCountdown(targetHoursFromNow: number) {
  const [target] = useState(() => Date.now() + targetHoursFromNow * 3600 * 1000);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, target - now);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { h, m, s };
}

export function SaleBanner() {
  const { h, m, s } = useCountdown(31);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    <Link
      href="/courses"
      className="block brand-gradient text-center text-sm text-white"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <Tag className="h-4 w-4" /> Launch sale — up to 60% off
        </span>
        <span className="opacity-90">Use code</span>
        <span className="rounded bg-white/25 px-1.5 py-0.5 font-mono font-semibold">LAUNCH40</span>
        <span className="tabular-nums opacity-90">
          ends in {pad(h)}:{pad(m)}:{pad(s)}
        </span>
      </div>
    </Link>
  );
}

export function formatUsd(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function compactNumber(n: number): string {
  return Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export function formatDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.round((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatHoursFromMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function lessonTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function relativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  const now = new Date("2026-06-23").getTime();
  const days = Math.round((now - then) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} month${months > 1 ? "s" : ""} ago`;
  return `${Math.round(months / 12)} year${months >= 24 ? "s" : ""} ago`;
}

// Deterministic vibrant gradient from a seed string (for course/avatar art).
const palettes = [
  ["#6366f1", "#a855f7"],
  ["#0ea5e9", "#6366f1"],
  ["#ec4899", "#8b5cf6"],
  ["#f59e0b", "#ef4444"],
  ["#10b981", "#06b6d4"],
  ["#8b5cf6", "#ec4899"],
  ["#3b82f6", "#22d3ee"],
  ["#f43f5e", "#f59e0b"],
];

export function gradientFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const [a, b] = palettes[h % palettes.length];
  const angle = 110 + (h % 60);
  return `linear-gradient(${angle}deg, ${a}, ${b})`;
}

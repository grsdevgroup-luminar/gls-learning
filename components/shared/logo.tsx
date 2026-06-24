import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  href = "/",
  showText = true,
  size = 36,
}: {
  className?: string;
  href?: string;
  showText?: boolean;
  size?: number;
}) {
  return (
    <Link href={href} className={cn("flex items-center gap-3 font-medium", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="SkillStream logo"
      >
        <title>SkillStream</title>
        <defs>
          <linearGradient id="ssBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e3a8a" />
            <stop offset="55%" stopColor="#1d4ed8" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
          <linearGradient id="ssBar" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#dbeafe" />
          </linearGradient>
          <radialGradient id="ssSheen" cx="30%" cy="20%" r="65%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <filter id="ssShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#1e3a8a" floodOpacity="0.35" />
          </filter>
        </defs>

        {/* rounded background with soft shadow */}
        <rect x="4" y="4" width="56" height="56" rx="16" fill="url(#ssBg)" filter="url(#ssShadow)" />

        {/* glass sheen for a premium glossy finish */}
        <ellipse cx="22" cy="16" rx="26" ry="14" fill="url(#ssSheen)" />

        {/* refined inner border, like a badge */}
        <rect x="6" y="6" width="52" height="52" rx="14" fill="none" stroke="#ffffff" strokeOpacity="0.18" />

        {/* three ascending bars: skill growth */}
        <rect x="18" y="32" width="8" height="16" rx="4" fill="url(#ssBar)" opacity="0.65" />
        <rect x="30" y="24" width="8" height="24" rx="4" fill="url(#ssBar)" opacity="0.85" />
        <rect x="42" y="14" width="8" height="34" rx="4" fill="url(#ssBar)" />

        {/* gold accent: the premium mark of mastery */}
        <circle cx="46" cy="9" r="3" fill="#fbbf24" />
      </svg>

      {showText && (
        <span className="text-lg font-semibold tracking-tight text-foreground">
          SkillStream
        </span>
      )}
    </Link>
  );
}

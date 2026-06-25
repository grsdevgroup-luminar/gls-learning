"use client";

/**
 * Cinematic motion primitives.
 *
 * One client module so server components (the homepage, course grids) can wrap
 * server-rendered children in motion without going client themselves. Every
 * primitive degrades gracefully under `prefers-reduced-motion`.
 */

import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  animate,
  type Variants,
} from "framer-motion";
import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

/* ── Reveal ────────────────────────────────────────────────────────────────
   Fades + lifts a block into view the first time it scrolls in. */
export function Reveal({
  children,
  delay = 0,
  y = 18,
  className,
  once = true,
  ...rest
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  once?: boolean;
} & ComponentProps<typeof motion.div>) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: reduce ? 0 : y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: "-12% 0px -8% 0px" }}
      transition={{ duration: 0.6, ease: EASE, delay }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/* ── Stagger ───────────────────────────────────────────────────────────────
   Parent that releases its <StaggerItem> children in a cascade. */
export function Stagger({
  children,
  className,
  amount = 0.2,
  gap = 0.08,
}: {
  children: ReactNode;
  className?: string;
  amount?: number;
  gap?: number;
}) {
  const variants: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: gap } },
  };
  return (
    <motion.div
      variants={variants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  y = 22,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  y?: number;
} & ComponentProps<typeof motion.div>) {
  const reduce = useReducedMotion();
  const variants: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : y },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
  };
  return (
    <motion.div variants={variants} className={className} {...rest}>
      {children}
    </motion.div>
  );
}

/* ── SpotlightCard ─────────────────────────────────────────────────────────
   A surface that pools an aurora glow under the cursor and lifts on hover.
   Pairs with the .spotlight / .spotlight-glow / .spotlight-ring utilities. */
export function SpotlightCard({
  children,
  className,
  lift = true,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  lift?: boolean;
} & ComponentProps<typeof motion.div>) {
  const ref = useRef<HTMLDivElement>(null);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      whileHover={lift ? { y: -4 } : undefined}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className={cn("spotlight", className)}
      {...rest}
    >
      <span aria-hidden className="spotlight-glow" />
      <span aria-hidden className="spotlight-ring" />
      <div className="relative z-[2] h-full">{children}</div>
    </motion.div>
  );
}

/* ── Magnetic ──────────────────────────────────────────────────────────────
   Pulls its child toward the cursor with a spring — great on CTAs. */
export function Magnetic({
  children,
  className,
  strength = 0.35,
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const x = useSpring(useMotionValue(0), { stiffness: 260, damping: 18 });
  const y = useSpring(useMotionValue(0), { stiffness: 260, damping: 18 });

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reduce) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * strength);
    y.set((e.clientY - (r.top + r.height / 2)) * strength);
  }
  function reset() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      style={{ x, y }}
      className={cn("inline-flex", className)}
    >
      {children}
    </motion.div>
  );
}

/* ── Counter ───────────────────────────────────────────────────────────────
   Counts a number up the first time it scrolls into view. */
export function Counter({
  value,
  suffix = "",
  prefix = "",
  decimals = 0,
  duration = 1.6,
  className,
}: {
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setDisplay(value);
      return;
    }
    const controls = animate(0, value, {
      duration,
      ease: EASE,
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [inView, value, duration, reduce]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {display.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

/* ── Parallax ──────────────────────────────────────────────────────────────
   Translates a layer against scroll for depth. */
export function Parallax({
  children,
  className,
  distance = 60,
}: {
  children: ReactNode;
  className?: string;
  distance?: number;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(
    scrollYProgress,
    [0, 1],
    reduce ? [0, 0] : [distance, -distance],
  );
  return (
    <motion.div ref={ref} style={{ y }} className={className}>
      {children}
    </motion.div>
  );
}

/* ── AuroraField ───────────────────────────────────────────────────────────
   Slow-drifting aurora blobs behind the page. Fixed, non-interactive, sits
   above the static body wash and below all content. */
export function AuroraField() {
  const reduce = useReducedMotion();
  const blob =
    "absolute rounded-full blur-[120px] mix-blend-screen will-change-transform";

  const float = (i: number) =>
    reduce
      ? {}
      : {
          x: [0, 24 * (i % 2 ? 1 : -1), 0],
          y: [0, -20, 0],
          scale: [1, 1.08, 1],
        };

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden opacity-[0.12] dark:opacity-[0.22]"
    >
      <motion.div
        className={cn(blob, "left-[-6%] top-[-12%] size-[42rem]")}
        style={{ background: "var(--aurora-1)" }}
        animate={float(0)}
        transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className={cn(blob, "left-[34%] top-[-18%] size-[46rem]")}
        style={{ background: "var(--aurora-2)" }}
        animate={float(1)}
        transition={{ duration: 32, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />
      <motion.div
        className={cn(blob, "right-[-8%] top-[-6%] size-[38rem]")}
        style={{ background: "var(--aurora-3)" }}
        animate={float(2)}
        transition={{ duration: 36, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
      <span className="grain" />
    </div>
  );
}


import * as React from "react";
import { Reveal } from "@/components/shared/motion";
import { cn } from "@/lib/utils";

/**
 * Page section scaffolding. Every storefront/dashboard section shares the same
 * max-width, horizontal padding and vertical rhythm so spacing stops being
 * hand-tuned per page. `tinted` paints the embedded secondary plane with
 * hairline borders (the "integrated panel" look used across the landing page).
 */
function Section({
  className,
  innerClassName,
  tinted = false,
  bordered = false,
  size = "default",
  children,
  ...props
}: React.ComponentProps<"section"> & {
  innerClassName?: string;
  tinted?: boolean;
  bordered?: boolean;
  size?: "default" | "sm" | "lg";
}) {
  const pad =
    size === "lg" ? "py-20 lg:py-28" : size === "sm" ? "py-10" : "py-16";
  return (
    <section
      className={cn(
        tinted && "bg-secondary/40",
        (tinted || bordered) && "border-y border-border",
        className
      )}
      {...props}
    >
      <div className={cn("mx-auto max-w-7xl px-4", pad, innerClassName)}>
        {children}
      </div>
    </section>
  );
}

/**
 * Standard section header: an optional tinted eyebrow, a display title, an
 * optional sub-line, and an optional right-aligned action (e.g. "View all").
 */
function SectionHeading({
  eyebrow,
  title,
  sub,
  action,
  align = "left",
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
  action?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <Reveal
      className={cn(
        "flex gap-4",
        action ? "items-end justify-between" : "flex-col",
        align === "center" && "flex-col items-center text-center",
        className
      )}
    >
      <div className={cn("max-w-2xl", align === "center" && "mx-auto")}>
        {eyebrow && <p className="text-eyebrow">{eyebrow}</p>}
        <h2
          className={cn(
            "text-3xl font-bold tracking-tight md:text-4xl",
            eyebrow && "mt-2"
          )}
        >
          {title}
        </h2>
        {sub && (
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            {sub}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </Reveal>
  );
}

export { Section, SectionHeading };

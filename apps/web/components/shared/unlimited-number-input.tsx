"use client";

import { useEffect, useRef } from "react";
import { Infinity as InfinityIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Number input + explicit "unlimited" toggle for the `0 = unlimited`
 * convention used across delivery-partner seat/usage caps
 * (DeliveryPartnerCourseAssignment.memberCap, DeliveryPartnerCampaign.
 * usageLimit — see docs/DELIVERY_PARTNER_MEMBER_FLOW_PLAN.md §3/§4.2). The
 * wire value is unchanged (still a plain integer, "0" for unlimited) — this
 * just replaces "type 0 and remember what that means" with a click.
 */
export function UnlimitedNumberInput({
  id,
  value,
  onChange,
  unlimitedValue = "0",
  defaultLimitedValue = "10",
  min = 0,
  max = 1000,
  className,
  inputClassName,
  "aria-label": ariaLabel,
  disabled,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  /** The value that means "unlimited" on the wire — "0" for every current
   *  caller, kept overridable in case that convention ever changes. */
  unlimitedValue?: string;
  /** Restored when toggling unlimited back off, unless this field already
   *  held a non-unlimited value this session (remembered below). */
  defaultLimitedValue?: string;
  min?: number;
  max?: number;
  className?: string;
  inputClassName?: string;
  "aria-label"?: string;
  disabled?: boolean;
}) {
  const isUnlimited = value === unlimitedValue;

  // Remembers the last non-unlimited value — whether typed here or received
  // fresh via props (e.g. on mount, or after a save resets the field to the
  // server's value) — so toggling unlimited on and back off restores it
  // instead of resetting to defaultLimitedValue every time. Synced in an
  // effect rather than during render, since refs must not be written there.
  const lastLimitedRef = useRef(defaultLimitedValue);
  useEffect(() => {
    if (!isUnlimited) lastLimitedRef.current = value;
  }, [isUnlimited, value]);

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        value={isUnlimited ? "" : value}
        // Short enough to stay readable in the tightest callers (the
        // assigned/add-course rows are ~64-80px wide) — the adjacent ∞
        // button already says "unlimited" unambiguously.
        placeholder={isUnlimited ? "No cap" : undefined}
        disabled={disabled || isUnlimited}
        aria-label={ariaLabel}
        className={inputClassName}
        onChange={(e) => onChange(e.target.value)}
      />
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              size="icon-sm"
              variant={isUnlimited ? "default" : "outline"}
              aria-pressed={isUnlimited}
              aria-label={isUnlimited ? "Unlimited — click to set a limit" : "Set unlimited"}
              disabled={disabled}
              onClick={() => onChange(isUnlimited ? lastLimitedRef.current : unlimitedValue)}
            />
          }
        >
          <InfinityIcon className="h-3.5 w-3.5" />
        </TooltipTrigger>
        <TooltipContent>{isUnlimited ? "Unlimited — click to set a limit" : "Set unlimited"}</TooltipContent>
      </Tooltip>
    </div>
  );
}

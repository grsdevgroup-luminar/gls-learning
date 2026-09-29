"use client";

import { useEffect, useRef, useState } from "react";
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
 *
 * "Unlimited" is only ever entered via the ∞ button (or an initial value
 * already at `unlimitedValue` when this field mounts, e.g. loaded from the
 * server) — never by typing. Typing a value below `min` (including "0") is
 * left on screen as-is and flagged invalid via `aria-invalid` / a red ring,
 * rather than being silently rewritten. Callers that need a blocking
 * validation message on save should watch `onValidityChange`. Give this
 * component a `key` tied to the record being edited (e.g. `campaign?.id`) so
 * its internal unlimited/valid state doesn't leak between records.
 */
export function UnlimitedNumberInput({
  id,
  value,
  onChange,
  onValidityChange,
  unlimitedValue = "0",
  defaultLimitedValue = "10",
  min = 1,
  max = 1000,
  className,
  inputClassName,
  "aria-label": ariaLabel,
  disabled,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  /** Called whenever the field's validity changes — `false` while a typed
   *  (non-toggled) value is empty or below `min`. Callers that need to block
   *  saving on an invalid value should track this. */
  onValidityChange?: (valid: boolean) => void;
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
  // Tracks whether unlimited mode was entered via the ∞ button (or was
  // already the value on mount) — deliberately NOT derived from
  // `value === unlimitedValue` on every render, so a typed "0" doesn't
  // silently collapse into the same disabled "No cap" state as the toggle.
  const [isUnlimited, setIsUnlimited] = useState(() => value === unlimitedValue);

  // Remembers the last non-unlimited value — whether typed here or received
  // fresh via props (e.g. on mount, or after a save resets the field to the
  // server's value) — so toggling unlimited on and back off restores it
  // instead of resetting to defaultLimitedValue every time. Synced in an
  // effect rather than during render, since refs must not be written there.
  const lastLimitedRef = useRef(defaultLimitedValue);
  useEffect(() => {
    if (!isUnlimited) lastLimitedRef.current = value;
  }, [isUnlimited, value]);

  const n = Number(value);
  const invalid = !isUnlimited && (value === "" || Number.isNaN(n) || n < min);

  useEffect(() => {
    onValidityChange?.(!invalid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invalid]);

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
        aria-invalid={invalid}
        className={cn(invalid && "border-destructive focus-visible:ring-destructive/20", inputClassName)}
        onChange={(e) => {
          setIsUnlimited(false);
          onChange(e.target.value);
        }}
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
              onClick={() => {
                const next = !isUnlimited;
                setIsUnlimited(next);
                onChange(next ? unlimitedValue : lastLimitedRef.current);
              }}
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

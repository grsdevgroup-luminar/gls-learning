'use client';

import { useEffect, useRef, useState } from 'react';
import { callingCodeFor, isValidPhone } from '@skillstream/shared';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

function nationalDigits(value: string, callingCode: string | undefined): string {
  if (!value) return '';
  if (callingCode && value.startsWith(callingCode)) {
    return value.slice(callingCode.length).replace(/\D/g, '');
  }
  return value.replace(/^\+/, '').replace(/\D/g, '');
}

/**
 * Phone field paired with a country. The calling code is derived from
 * `country` and shown as a fixed prefix — the input itself only ever holds
 * the national number, and the composed E.164 string is what's reported
 * through `onChange`. Falls back to a plain "+"-prefixed freeform field
 * when no country is selected yet (or the country has no dial-plan
 * metadata, e.g. Antarctica).
 */
export function PhoneInput({
  country,
  value,
  onChange,
  className,
}: {
  country: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const callingCode = country ? callingCodeFor(country) : undefined;
  const [digits, setDigits] = useState(() => nationalDigits(value, callingCode));
  const mounted = useRef(false);

  // A number typed under one country's dial plan isn't a number under
  // another's, so switching country clears the national number rather than
  // re-prefixing stale digits — the one exception is the initial mount,
  // which needs to load whatever's already saved.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setDigits('');
    onChange('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callingCode]);

  function handleChange(raw: string) {
    const next = raw.replace(/\D/g, '');
    setDigits(next);
    onChange(callingCode ? `${callingCode}${next}` : next ? `+${next}` : '');
  }

  const full = callingCode ? `${callingCode}${digits}` : value;
  const showError = digits.length > 0 && !isValidPhone(full);

  return (
    <div className={className}>
      <div className="flex gap-2">
        {callingCode && (
          <span className="flex shrink-0 items-center rounded-md border bg-muted px-3 text-sm text-muted-foreground">
            {callingCode}
          </span>
        )}
        <Input
          type="tel"
          inputMode="numeric"
          value={digits}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={callingCode ? '1712345678' : '+8801712345678'}
          className={cn('flex-1', showError && 'border-destructive focus-visible:ring-destructive/40')}
        />
      </div>
      {showError && (
        <p className="mt-1.5 text-xs text-destructive">
          That doesn&apos;t look like a valid phone number{country ? ' for the selected country' : ''}.
        </p>
      )}
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { COUNTRIES, flagFor, nameFor } from '@/lib/countries';
import { useDebouncedSearch } from '@/lib/use-debounced-value';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export function CountrySelect({
  value,
  onChange,
  placeholder = 'Select your country',
  excludeCodes = [],
}: {
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
  /** ISO codes already in use — hidden from the picker. */
  excludeCodes?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedSearch(query);

  const available = useMemo(() => {
    if (excludeCodes.length === 0) return COUNTRIES;
    const skip = new Set(excludeCodes.map((c) => c.toUpperCase()));
    return COUNTRIES.filter((c) => !skip.has(c.code));
  }, [excludeCodes]);

  const filteredCountries = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return available;
    return available.filter((c) => c.name.toLowerCase().includes(q));
  }, [available, debouncedQuery]);

  if (COUNTRIES.length === 0) {
    return (
      <p className="text-sm text-destructive">
        Country list unavailable. Rebuild shared:{" "}
        <code className="text-xs">pnpm --filter @skillstream/shared build</code>
      </p>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between font-normal"
          />
        }
      >
        {value ? (
          <span className="flex items-center gap-2 truncate">
            <span>{flagFor(value)}</span>
            <span className="truncate">{nameFor(value) ?? value}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        <ChevronsUpDown className="h-4 w-4 opacity-50" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--anchor-width)] p-0">
        <div className="relative border-b p-2">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search country…"
            className="h-8 pl-8"
            autoFocus
          />
        </div>
        <ul className="max-h-64 overflow-y-auto py-1">
          {filteredCountries.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">No matches</li>
          ) : (
            filteredCountries.map((c) => (
              <li key={c.code}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
                  onClick={() => {
                    onChange(c.code);
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  <span>{flagFor(c.code)}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  {value === c.code && <Check className="h-4 w-4 text-primary" />}
                </button>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

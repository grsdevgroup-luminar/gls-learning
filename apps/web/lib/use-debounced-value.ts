"use client";

import { useEffect, useState } from "react";

/** Return the latest value only after it has stayed unchanged for `delay` ms. */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timeout);
  }, [value, delay]);

  return debouncedValue;
}

/** Debounce a search query and keep it inactive until it has enough letters. */
export function useDebouncedSearch(
  value: string,
  delay = 300,
  minLength = 2,
): string {
  const debouncedValue = useDebouncedValue(value, delay);
  const query = debouncedValue.trim();
  return query.length >= minLength ? query : "";
}

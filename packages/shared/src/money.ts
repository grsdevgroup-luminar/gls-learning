// ---------------------------------------------------------------------------
// Money is always stored and transported as integer cents (USD) to avoid float
// drift. Convert to/from display dollars only at the UI edge.
// ---------------------------------------------------------------------------

export function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function toDollars(cents: number): number {
  return cents / 100;
}

/** Format a USD cents amount as a plain dollar string, e.g. 4999 -> "$49.99". */
export function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

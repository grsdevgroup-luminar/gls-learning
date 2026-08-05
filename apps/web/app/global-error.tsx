"use client";

// Root catch-all: only fires when an error escapes every nested error.tsx
// (or occurs in the root layout itself, which no nested boundary can catch).
// Next.js requires this file to render its own <html>/<body> since it
// replaces the root layout entirely when active.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center font-sans">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          The application hit an unexpected error. Please try again.
        </p>
        <button
          onClick={reset}
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white"
        >
          Try again
        </button>
      </body>
    </html>
  );
}

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function CertificatePrintClient() {
  useEffect(() => {
    // Keep browser Back anchored to the student's Certificates section even
    // when this print view was reached from another student dashboard page.
    const printUrl = window.location.href;
    window.history.replaceState(window.history.state, '', '/dashboard/certificates');
    window.history.pushState(window.history.state, '', printUrl);

    let cancelled = false;
    const printWhenReady = async () => {
      await document.fonts.ready.catch(() => undefined);
      if (!cancelled) window.print();
    };
    const id = window.setTimeout(() => void printWhenReady(), 250);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, []);

  return null;
}

export function CertificatePrintActions() {
  const router = useRouter();

  return (
    <div className="fixed right-4 top-4 z-10 flex items-center gap-2 print:hidden">
      <Button type="button" onClick={() => window.print()}>
        Print / Save PDF
      </Button>
      <Button variant="outline" onClick={() => router.push('/dashboard/certificates')}>
        Back
      </Button>
    </div>
  );
}

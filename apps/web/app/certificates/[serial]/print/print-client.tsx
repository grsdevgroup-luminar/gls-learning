'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function CertificatePrintClient() {
  useEffect(() => {
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
  return (
    <div className="fixed right-4 top-4 z-10 flex items-center gap-2 print:hidden">
      <Button type="button" onClick={() => window.print()}>
        Print / Save PDF
      </Button>
      <Button variant="outline" render={<Link href="/dashboard/certificates" />}>
        Back
      </Button>
    </div>
  );
}

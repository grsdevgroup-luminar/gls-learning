import Link from 'next/link';
import type { Metadata } from 'next';
import type { CertificateVerificationDto } from '@skillstream/shared';
import { serverApiOptional } from '@/lib/api/server';
import { Button } from '@/components/ui/button';
import { CertificatePreview } from '@/components/shared/certificate-preview';
import { CertificatePrintActions, CertificatePrintClient } from './print-client';

export const metadata: Metadata = {
  title: 'Certificate PDF · GRS Learning',
};

export default async function CertificatePrintPage({
  params,
}: {
  params: Promise<{ serial: string }>;
}) {
  const { serial } = await params;
  const cert = await serverApiOptional<CertificateVerificationDto>(
    `/certificates/${encodeURIComponent(serial)}`,
  );

  if (!cert) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-bold">Certificate not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          No certificate matches this serial.
        </p>
        <Button className="mt-6" variant="outline" render={<Link href="/courses" />}>
          Browse courses
        </Button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/40 text-foreground print:bg-white">
      <style>{`
        @page {
          size: A4 landscape;
          margin: 0;
        }

        @media print {
          html,
          body {
            width: 297mm;
            height: 210mm;
            margin: 0 !important;
            overflow: hidden !important;
            background: white !important;
          }

          body > div,
          main {
            width: 297mm !important;
            height: 210mm !important;
            min-height: 0 !important;
            overflow: hidden !important;
          }

          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
      <CertificatePrintClient />
      <CertificatePrintActions />
      <div className="flex min-h-screen items-center justify-center p-6 print:block print:h-[210mm] print:min-h-0 print:w-[297mm] print:overflow-hidden print:p-0">
        <CertificatePreview
          courseTitle={cert.courseTitle}
          userName={cert.learnerName}
          issuedAt={cert.issuedAt}
          serial={cert.serial}
          print
        />
      </div>
    </main>
  );
}

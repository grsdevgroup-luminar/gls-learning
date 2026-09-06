import Link from 'next/link';
import type { Metadata } from 'next';
import type { CertificateVerificationDto } from '@skillstream/shared';
import { serverApiOptional } from '@/lib/api/server';
import { Button } from '@/components/ui/button';
import { CertificateTemplate } from '@/components/shared/certificate-template';
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
          size: A4 portrait;
          margin: 0;
        }

        @media print {
          html,
          body {
            width: 210mm;
            height: 297mm;
            margin: 0 !important;
            overflow: hidden !important;
            background: white !important;
          }

          body > div,
          main {
            width: 210mm !important;
            height: 297mm !important;
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
      <div className="flex min-h-screen items-center justify-center p-6 print:block print:h-[297mm] print:min-h-0 print:w-[210mm] print:overflow-hidden print:p-0">
        <CertificateTemplate
          variant="print"
          data={{
            studentName: cert.learnerName,
            courseName: cert.courseTitle,
            certificateNumber: cert.serial,
            uniqueId: cert.serial,
            courseNumber: cert.courseNumber,
            courseStartDate: formatDate(cert.courseStartDate),
            courseEndDate: formatDate(cert.courseEndDate),
            issueDate: formatDate(cert.issuedAt),
            verificationUrl: cert.verificationUrl,
            isoStandard: cert.isoStandard,
          }}
        />
      </div>
    </main>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: '2-digit', day: '2-digit', year: 'numeric', timeZone: 'UTC',
  });
}

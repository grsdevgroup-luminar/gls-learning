'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useSession } from '@/lib/api/session';
import { apiFetch } from '@/lib/api/client';
import { CertificatePreview } from '@/components/shared/certificate-preview';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Award,
  Download,
  GraduationCap,
  Share2,
  ShieldCheck,
} from 'lucide-react';

interface CertificateDto {
  serial: string;
  pdfUrl: string | null;
  issuedAt: string;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
}

export default function CertificatesPage() {
  const { user } = useSession();
  const [active, setActive] = useState<CertificateDto | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const { data: certs, isLoading, isError } = useQuery({
    queryKey: ['me', 'certificates'],
    queryFn: () => apiFetch<CertificateDto[]>('/me/certificates'),
  });

  if (isLoading) {
    return (
      <div className="space-y-8 p-6 md:p-8">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-52 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-8 p-6 md:p-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Certificates</h1>
        </div>
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            Could not load certificates. Please try again later.
          </CardContent>
        </Card>
      </div>
    );
  }

  const earned = certs ?? [];
  const userName = user?.name ?? '';

  // Shares the public verification page — a link anyone can open, unlike the
  // dashboard route it used to point at.
  const share = async (cert: CertificateDto) => {
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/verify/${cert.serial}`
        : '';
    const data = {
      title: `${cert.courseTitle} — Certificate of Completion`,
      text: `I just completed "${cert.courseTitle}" on GRS Learning 🎓`,
      url,
    };
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(data);
        toast.success('Certificate share sheet opened');
        return;
      } catch {
        // Fall back to copying the public verification link.
      }
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
        toast.success('Certificate link copied');
        return;
      } catch {
        toast.error('Could not copy certificate link');
        return;
      }
    }
    toast.error('Sharing is not available in this browser');
  };

  const downloadCertificate = async (cert: CertificateDto) => {
    setDownloading(cert.serial);
    try {
      window.open(
        `/certificates/${encodeURIComponent(cert.serial)}/print`,
        '_blank',
        'noopener,noreferrer',
      );
    } catch {
      toast.error('Could not open certificate PDF page');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-8 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Certificates</h1>
        <p className="text-muted-foreground">
          You&apos;ve earned {earned.length} certificate{earned.length !== 1 && 's'}.
          Finish a course to unlock more.
        </p>
      </div>

      {earned.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {earned.map((cert) => (
            <Card
              key={cert.serial}
              className="overflow-hidden p-0 transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              <CardContent className="p-0">
                <button
                  type="button"
                  onClick={() => setActive(cert)}
                  className="block w-full cursor-pointer text-left"
                  aria-label={`View certificate for ${cert.courseTitle}`}
                >
                  <CertificatePreview
                    courseTitle={cert.courseTitle}
                    userName={userName}
                    issuedAt={cert.issuedAt}
                    serial={cert.serial}
                    small
                  />
                </button>
                <div className="flex items-center justify-between p-3">
                  <span className="truncate text-sm font-medium">{cert.courseTitle}</span>
                  <Badge variant="secondary" className="shrink-0 text-success">
                    <Award className="mr-1 h-3 w-3" />
                  </Badge>
                </div>
                <div className="flex gap-2 border-t border-border px-3 py-2">
                  <Button size="sm" variant="outline" onClick={() => share(cert)}>
                    <Share2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => void downloadCertificate(cert)}
                    disabled={downloading === cert.serial}
                  >
                    <Download className="mr-1 h-3.5 w-3.5" />
                    {downloading === cert.serial ? 'Downloading...' : 'Download PDF'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {earned.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <GraduationCap className="mx-auto mb-3 h-10 w-10 opacity-40" />
            <p className="font-medium">No certificates yet</p>
            <p className="mt-1 text-sm">Complete a course to earn your first certificate.</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!active} onOpenChange={(open) => !open && setActive(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogTitle className="sr-only">
            {active ? `Certificate — ${active.courseTitle}` : 'Certificate'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Certificate of completion, shareable and downloadable.
          </DialogDescription>
          {active && (
            <>
              <CertificatePreview
                courseTitle={active.courseTitle}
                userName={userName}
                issuedAt={active.issuedAt}
                serial={active.serial}
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  render={<a href={`/verify/${active.serial}`} target="_blank" rel="noopener noreferrer" />}
                >
                  <ShieldCheck className="mr-1.5 h-4 w-4" /> Verify
                </Button>
                <Button variant="outline" onClick={() => share(active)}>
                  <Share2 className="mr-1.5 h-4 w-4" /> Share
                </Button>
                <Button
                  onClick={() => void downloadCertificate(active)}
                  disabled={downloading === active.serial}
                >
                  <Download className="mr-1.5 h-4 w-4" />
                  {downloading === active.serial ? 'Downloading...' : 'Download PDF'}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}



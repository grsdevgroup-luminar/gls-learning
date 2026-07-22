'use client';

import { useState } from 'react';
import { Playfair_Display } from 'next/font/google';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useSession } from '@/lib/api/session';
import { apiFetch } from '@/lib/api/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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

// Certificate-only display face — a classic serif that reads as an
// institution's letterhead rather than the app's product UI.
const serif = Playfair_Display({
  variable: '--font-certificate',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  style: ['normal', 'italic'],
});

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

  const share = async (cert: CertificateDto) => {
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/dashboard/certificates`
        : '';
    const data = {
      title: `${cert.courseTitle} — Certificate of Completion`,
      text: `I just completed "${cert.courseTitle}" on SkillStream 🎓`,
      url,
    };
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(data);
      } catch {
        // user dismissed the share sheet — nothing to do
      }
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard');
    }
  };

  return (
    <div className={`${serif.variable} space-y-8 p-6 md:p-8`}>
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
                  <TooltipProvider>
                    {cert.pdfUrl ? (
                      <Button
                        size="sm"
                        className="flex-1"
                        render={<a href={cert.pdfUrl} target="_blank" rel="noopener noreferrer" />}
                      >
                        <Download className="mr-1 h-3.5 w-3.5" /> Download PDF
                      </Button>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger render={<span className="flex-1" />}>
                          <Button size="sm" className="w-full" disabled>
                            <Download className="mr-1 h-3.5 w-3.5" /> Download PDF
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Coming soon</TooltipContent>
                      </Tooltip>
                    )}
                  </TooltipProvider>
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
        <DialogContent className={`${serif.variable} sm:max-w-2xl`}>
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
                <Button variant="outline" onClick={() => share(active)}>
                  <Share2 className="mr-1.5 h-4 w-4" /> Share
                </Button>
                <TooltipProvider>
                  {active.pdfUrl ? (
                    <Button render={<a href={active.pdfUrl} target="_blank" rel="noopener noreferrer" />}>
                      <Download className="mr-1.5 h-4 w-4" /> Download PDF
                    </Button>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger render={<span />}>
                        <Button disabled>
                          <Download className="mr-1.5 h-4 w-4" /> Download PDF
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Coming soon</TooltipContent>
                    </Tooltip>
                  )}
                </TooltipProvider>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CertificatePreview({
  courseTitle,
  userName,
  issuedAt,
  serial,
  small,
}: {
  courseTitle: string;
  userName: string;
  issuedAt: string;
  serial: string;
  small?: boolean;
}) {
  const issuedDate = new Date(issuedAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div
      className={`relative isolate overflow-hidden ${small ? 'rounded-t-xl p-5' : 'rounded-2xl p-10 sm:p-14'} border border-amber-500/25 bg-linear-to-br from-primary/6 via-background to-chart-2/6 text-center dark:border-amber-300/20`}
      style={{ fontFamily: 'var(--font-certificate), serif' }}
    >
      {/* faint guilloché-style dot texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05] dark:opacity-[0.08]"
        style={{
          backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)',
          backgroundSize: small ? '10px 10px' : '14px 14px',
          color: 'var(--primary)',
        }}
      />

      {/* double hairline frame */}
      <div className={`pointer-events-none absolute ${small ? 'inset-1.5' : 'inset-3'} rounded-xl border border-amber-500/35 dark:border-amber-300/25`} />
      <div className={`pointer-events-none absolute ${small ? 'inset-2.5' : 'inset-5'} rounded-lg border border-amber-500/15 dark:border-amber-300/10`} />

      {/* corner flourishes */}
      {!small && (
        <>
          <CornerMark className="left-4 top-4" />
          <CornerMark className="right-4 top-4 rotate-90" />
          <CornerMark className="bottom-4 right-4 rotate-180" />
          <CornerMark className="bottom-4 left-4 -rotate-90" />
        </>
      )}

      <div className="relative flex flex-col items-center">
        <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
          <GraduationCap className={small ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
          <span className={`font-sans font-semibold uppercase text-foreground/70 ${small ? 'text-[9px] tracking-[0.25em]' : 'text-[11px] tracking-[0.35em]'}`}>
            SkillStream Academy
          </span>
        </div>

        {!small && (
          <p className="mt-6 font-sans text-[11px] font-medium uppercase tracking-[0.4em] text-muted-foreground">
            Certificate of Completion
          </p>
        )}

        <p className={`font-sans text-muted-foreground ${small ? 'mt-2 text-[10px]' : 'mt-6 text-sm'}`}>
          This certifies that
        </p>
        <p className={`font-semibold text-foreground ${small ? 'text-base' : 'mt-2 text-4xl'}`}>
          {userName}
        </p>
        <div className={`bg-linear-to-r from-transparent via-amber-500/60 to-transparent ${small ? 'mt-1 h-px w-16' : 'mt-2 h-px w-44'}`} />

        <p className={`font-sans text-muted-foreground ${small ? 'mt-2 text-[10px]' : 'mt-5 text-sm'}`}>
          has successfully completed the course
        </p>
        <p className={`font-semibold italic text-primary ${small ? 'text-sm' : 'mt-2 max-w-md text-xl'}`}>
          {courseTitle}
        </p>

        {!small && (
          <>
            <div className="relative mt-10 grid h-16 w-16 place-items-center rounded-full border-2 border-amber-500/50 bg-linear-to-br from-amber-400/15 to-amber-600/10 text-amber-700 shadow-inner dark:border-amber-300/40 dark:text-amber-300">
              <ShieldCheck className="h-7 w-7" />
              <div className="absolute -inset-1 rounded-full border border-dashed border-amber-500/30 dark:border-amber-300/25" />
            </div>

            <div className="mt-8 grid w-full grid-cols-2 gap-10 font-sans text-xs">
              <div className="flex flex-col items-center gap-1.5">
                <p className="italic text-foreground" style={{ fontFamily: 'var(--font-certificate), serif' }}>
                  SkillStream
                </p>
                <div className="h-px w-full bg-border" />
                <p className="uppercase tracking-wide text-muted-foreground">Issuing Platform</p>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <p className="font-medium text-foreground">{issuedDate}</p>
                <div className="h-px w-full bg-border" />
                <p className="uppercase tracking-wide text-muted-foreground">Date Issued</p>
              </div>
            </div>

            <p className="mt-6 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Verify · Serial {serial}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function CornerMark({ className }: { className: string }) {
  return (
    <svg
      className={`pointer-events-none absolute h-5 w-5 text-amber-500/50 dark:text-amber-300/40 ${className}`}
      viewBox="0 0 20 20"
      fill="none"
    >
      <path d="M1 1H10" stroke="currentColor" strokeWidth="1.25" />
      <path d="M1 1V10" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="1" cy="1" r="2" fill="currentColor" />
    </svg>
  );
}

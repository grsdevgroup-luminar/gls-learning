'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/lib/api/session';
import { apiFetch } from '@/lib/api/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Award,
  Download,
  GraduationCap,
  CheckCircle2,
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

  return (
    <div className="space-y-8 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Certificates</h1>
        <p className="text-muted-foreground">
          You've earned {earned.length} certificate{earned.length !== 1 && 's'}.
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
                <CertificatePreview
                  courseTitle={cert.courseTitle}
                  userName={user?.name ?? ''}
                  issuedAt={cert.issuedAt}
                  serial={cert.serial}
                  small
                />
                <div className="flex items-center justify-between p-3">
                  <span className="truncate text-sm font-medium">{cert.courseTitle}</span>
                  <Badge variant="secondary" className="shrink-0 text-success">
                    <Award className="mr-1 h-3 w-3" />
                  </Badge>
                </div>
                <div className="flex gap-2 border-t border-border px-3 py-2">
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
    year: 'numeric',
  });

  return (
    <div
      className={`relative overflow-hidden ${small ? 'rounded-t-xl' : 'rounded-xl'} border bg-linear-to-br from-primary/5 via-background to-chart-2/5 ${small ? 'p-5' : 'p-10'} text-center`}
    >
      <div className="absolute inset-0 m-2 rounded-lg border-2 border-primary/20" />
      <div className="relative">
        <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full brand-gradient text-white">
          <GraduationCap className={small ? 'h-5 w-5' : 'h-6 w-6'} />
        </div>
        {!small && (
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Certificate of Completion
          </p>
        )}
        <p className={`mt-2 ${small ? 'text-xs' : 'text-sm'} text-muted-foreground`}>
          This certifies that
        </p>
        <p className={`font-bold ${small ? 'text-base' : 'text-2xl'}`}>
          {userName}
        </p>
        <p className={`mt-1 ${small ? 'text-xs' : 'text-sm'} text-muted-foreground`}>
          has successfully completed
        </p>
        <p className={`font-semibold text-primary ${small ? 'text-sm' : 'text-lg'}`}>
          {courseTitle}
        </p>
        {!small && (
          <div className="mt-6 flex flex-col items-center gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-success" /> Verified · SkillStream
              </div>
              <div>{issuedDate}</div>
            </div>
            <div className="font-mono text-[10px] opacity-60">Serial: {serial}</div>
          </div>
        )}
      </div>
    </div>
  );
}

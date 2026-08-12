import { GraduationCap, ShieldCheck } from 'lucide-react';

export function CertificatePreview({
  courseTitle,
  userName,
  issuedAt,
  serial,
  small,
  print,
}: {
  courseTitle: string;
  userName: string;
  issuedAt: string;
  serial: string;
  small?: boolean;
  print?: boolean;
}) {
  const issuedDate = new Date(issuedAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const sizeClass = print
    ? 'h-[210mm] w-[297mm] max-w-full origin-center rounded-none p-[18mm] shadow-xl print:max-w-none print:shadow-none'
    : small
      ? 'rounded-t-xl p-5'
      : 'rounded-2xl p-10 sm:p-14';

  return (
    <div
      className={`relative isolate overflow-hidden ${sizeClass} border border-amber-500/25 bg-linear-to-br from-primary/6 via-background to-chart-2/6 text-center dark:border-amber-300/20`}
      style={{ fontFamily: 'var(--font-certificate), serif' }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05] dark:opacity-[0.08]"
        style={{
          backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)',
          backgroundSize: small ? '10px 10px' : '14px 14px',
          color: 'var(--primary)',
        }}
      />

      <div className={`pointer-events-none absolute ${small ? 'inset-1.5' : 'inset-3'} rounded-xl border border-amber-500/35 dark:border-amber-300/25`} />
      <div className={`pointer-events-none absolute ${small ? 'inset-2.5' : 'inset-5'} rounded-lg border border-amber-500/15 dark:border-amber-300/10`} />

      {!small && (
        <>
          <CornerMark className="left-4 top-4" />
          <CornerMark className="right-4 top-4 rotate-90" />
          <CornerMark className="bottom-4 right-4 rotate-180" />
          <CornerMark className="bottom-4 left-4 -rotate-90" />
        </>
      )}

      <div className={`relative flex h-full flex-col items-center ${print ? 'justify-center gap-10' : ''}`}>
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
            <GraduationCap className={small ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
            <span className={`font-sans font-semibold uppercase text-foreground/70 ${small ? 'text-[9px] tracking-[0.25em]' : 'text-[11px] tracking-[0.35em]'}`}>
              GRS Learning Academy
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
        </div>

        {!small && (
          <div className="flex w-full flex-col items-center">
            <div className={`relative grid h-16 w-16 place-items-center rounded-full border-2 border-amber-500/50 bg-linear-to-br from-amber-400/15 to-amber-600/10 text-amber-700 shadow-inner dark:border-amber-300/40 dark:text-amber-300 ${print ? '' : 'mt-10'}`}>
              <ShieldCheck className="h-7 w-7" />
              <div className="absolute -inset-1 rounded-full border border-dashed border-amber-500/30 dark:border-amber-300/25" />
            </div>

            <div className={`${print ? 'mt-6' : 'mt-8'} grid w-full grid-cols-2 gap-10 font-sans text-xs`}>
              <div className="flex flex-col items-center gap-1.5">
                <p className="italic text-foreground" style={{ fontFamily: 'var(--font-certificate), serif' }}>
                  GRS Learning
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

            <p className={`${print ? 'mt-4' : 'mt-6'} font-mono text-[10px] uppercase tracking-wider text-muted-foreground`}>
              Verify · Serial {serial}
            </p>
          </div>
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


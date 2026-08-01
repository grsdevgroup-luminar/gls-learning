import Link from "next/link";
import type { Metadata } from "next";
import type { CertificateVerificationDto } from "@skillstream/shared";
import { serverApiOptional } from "@/lib/api/server";
import { apiUrl } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BadgeCheck, Download, ShieldX } from "lucide-react";

export const metadata: Metadata = {
  title: "Verify a certificate · SkillStream",
  description: "Check that a SkillStream certificate of completion is genuine.",
};

/** Public — anyone holding a serial (an employer, say) can confirm it's real. */
export default async function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ serial: string }>;
}) {
  const { serial } = await params;
  const cert = await serverApiOptional<CertificateVerificationDto>(
    `/certificates/${encodeURIComponent(serial)}`,
  );

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <Card variant="elevated">
        <CardContent className="space-y-5 py-8 text-center">
          {cert ? (
            <>
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-success/10 text-success">
                <BadgeCheck className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Certificate verified</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  This certificate was issued by SkillStream.
                </p>
              </div>
              <dl className="grid gap-3 rounded-xl border border-border bg-muted/30 p-5 text-left text-sm">
                <Row label="Awarded to" value={cert.learnerName} />
                <Row label="Course" value={cert.courseTitle} />
                <Row
                  label="Issued"
                  value={new Date(cert.issuedAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                />
                <Row label="Serial" value={cert.serial} mono />
              </dl>
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  render={
                    <a
                      href={apiUrl(`/certificates/${encodeURIComponent(cert.serial)}/pdf`)}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                >
                  <Download className="mr-1.5 h-4 w-4" /> View PDF
                </Button>
                <Button variant="outline" render={<Link href={`/courses/${cert.courseSlug}`} />}>
                  View the course
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-destructive/10 text-destructive">
                <ShieldX className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Certificate not found</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  No certificate matches serial{" "}
                  <span className="font-mono text-foreground">{serial}</span>. Check for
                  typos — serials look like <span className="font-mono">CERT-9F2C71A0B4D3</span>.
                </p>
              </div>
              <Button variant="outline" render={<Link href="/courses" />}>
                Browse courses
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono text-xs" : "font-medium"}>{value}</dd>
    </div>
  );
}

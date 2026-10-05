"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { OrganizationDto } from "@skillstream/shared";
import { orgApi } from "@/lib/api/endpoints";
import { Button } from "@/components/ui/button";
import { LockKeyhole } from "lucide-react";

export function OrgAccessGate({
  slug,
  enabled,
  initialOrganization,
  children,
}: {
  slug: string;
  enabled: boolean;
  initialOrganization: OrganizationDto | null;
  children: ReactNode;
}) {
  const { data: org, isLoading, isError, refetch } = useQuery({
    queryKey: ["org", slug],
    queryFn: () => orgApi.bySlug(slug),
    enabled,
    initialData: initialOrganization ?? undefined,
    refetchInterval: enabled ? 30_000 : false,
    refetchOnWindowFocus: true,
  });

  if (!enabled) return children;

  if (isLoading && !org) {
    return (
      <main className="grid min-h-screen place-items-center p-6 text-sm text-muted-foreground">
        Verifying organization access…
      </main>
    );
  }

  if (isError || !org) {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <section className="w-full max-w-md space-y-4 rounded-xl border bg-card p-6 text-center">
          <LockKeyhole className="mx-auto size-8 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Organization access unavailable</h1>
          <p className="text-sm text-muted-foreground">
            We couldn&apos;t verify your organization access. Please retry or contact your GRS Learning administrator.
          </p>
          <Button variant="outline" onClick={() => void refetch()}>Retry</Button>
        </section>
      </main>
    );
  }

  if (org.accessLocked) {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <section className="w-full max-w-md space-y-4 rounded-xl border bg-card p-6 text-center">
          <LockKeyhole className="mx-auto size-8 text-destructive" />
          <h1 className="text-lg font-semibold">{org.name} is suspended</h1>
          <p className="text-sm text-muted-foreground">
            Organization portal and assigned-course access are paused. Contact your GRS Learning administrator to restore access.
          </p>
          <Button variant="outline" render={<a href="/">Back to GRS Learning</a>} />
        </section>
      </main>
    );
  }

  return children;
}

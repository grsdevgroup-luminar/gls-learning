"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orgApi } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api/errors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { Building2, Mail, Globe, Calendar, Shield } from "lucide-react";

const statusColors: Record<string, string> = {
  ACTIVE: "text-success",
  TRIAL: "text-warning",
  SUSPENDED: "text-destructive",
};

export default function OrgAccount() {
  const params = useParams<{ slug: string }>();
  const qc = useQueryClient();
  const [edit, setEdit] = useState<{ name: string; domain: string; logoUrl: string } | null>(null);
  const { data: org } = useQuery({
    queryKey: ["org", params.slug],
    queryFn: () => orgApi.bySlug(params.slug),
    enabled: !!params.slug,
  });
  const { data: courses } = useQuery({
    queryKey: ["org", org?.id, "courses"],
    queryFn: () => orgApi.courses(org!.id),
    enabled: !!org?.id,
  });

  const save = useMutation({
    mutationFn: () =>
      orgApi.update(org!.id, {
        name: edit!.name.trim(),
        // Empty strings would fail validation — omit instead of sending blanks.
        ...(edit!.domain.trim() ? { domain: edit!.domain.trim() } : {}),
        ...(edit!.logoUrl.trim() ? { logoUrl: edit!.logoUrl.trim() } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org"] });
      setEdit(null);
      toast.success("Organization updated");
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  if (!org) return null;

  const fields = [
    { icon: Building2, label: "Organization name", value: org.name },
    { icon: Mail, label: "Admin email", value: org.adminEmail },
    { icon: Globe, label: "Email domain", value: org.domain ?? "—" },
    {
      icon: Calendar,
      label: "Member since",
      value: new Date(org.createdAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Account</h1>
        <p className="text-muted-foreground">Organization details and plan information.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Organization info</span>
            <span className="flex items-center gap-2">
              <Badge variant="outline" className={statusColors[org.status]}>
                {org.status.charAt(0) + org.status.slice(1).toLowerCase()}
              </Badge>
              {!edit && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setEdit({
                      name: org.name,
                      domain: org.domain ?? "",
                      logoUrl: org.logoUrl ?? "",
                    })
                  }
                >
                  Edit
                </Button>
              )}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {edit ? (
            <>
              <FormField label="Organization name">
                <Input
                  value={edit.name}
                  onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                />
              </FormField>
              <FormField label="Email domain" hint="Optional">
                <Input
                  value={edit.domain}
                  onChange={(e) => setEdit({ ...edit, domain: e.target.value })}
                  placeholder="acme.com"
                />
              </FormField>
              <FormField label="Logo URL" hint="Optional">
                <Input
                  value={edit.logoUrl}
                  onChange={(e) => setEdit({ ...edit, logoUrl: e.target.value })}
                  placeholder="https://acme.com/logo.png"
                  type="url"
                />
              </FormField>
              <div className="flex gap-2">
                <Button
                  onClick={() => save.mutate()}
                  disabled={save.isPending || edit.name.trim().length < 2}
                >
                  {save.isPending ? "Saving…" : "Save changes"}
                </Button>
                <Button variant="outline" onClick={() => setEdit(null)}>
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            fields.map((f) => (
              <div key={f.label} className="flex items-start gap-3">
                <f.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">{f.label}</div>
                  <div className="font-medium">{f.value}</div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" /> Seat plan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total seats</span>
            <span className="font-semibold">{org.seatCount}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Used seats</span>
            <span className="font-semibold">{org.usedSeats}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Available seats</span>
            <span className="font-semibold text-success">{org.seatCount - org.usedSeats}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(100, (org.usedSeats / org.seatCount) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Seats are managed by SkillStream — contact your account manager to
            add more.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assigned courses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Private courses</span>
            <span className="font-semibold">{(courses ?? []).length}</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            To add or remove courses from your organization, go to the Courses tab. Contact support to request new specialized course content.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

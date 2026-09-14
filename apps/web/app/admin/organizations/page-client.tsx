"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orgApi } from "@/lib/api/endpoints";
import type { OrganizationDto, CreateOrganizationResultDto } from "@skillstream/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Building2, Users, BookOpen, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { useDebouncedSearch } from "@/lib/use-debounced-value";
import { getApiErrorMessage } from "@/lib/api/errors";
import { PlanDialog } from "./plan-dialog";
import { CredentialsPanel } from "./credentials-panel";
import { ManageOrgCoursesDialog } from "@/components/shared/manage-org-courses-dialog";

const statusColors: Record<string, string> = {
  ACTIVE: "text-success",
  TRIAL: "text-warning",
  SUSPENDED: "text-destructive",
};

export default function AdminOrganizations() {
  const qc = useQueryClient();
  const [qInput, setQInput] = useState("");
  const q = useDebouncedSearch(qInput);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", domain: "", adminEmail: "", seatCount: "10" });
  const [credentials, setCredentials] = useState<CreateOrganizationResultDto | null>(null);

  const { data: orgs = [], isLoading } = useQuery<OrganizationDto[]>({
    queryKey: ["admin-organizations"],
    queryFn: orgApi.list,
  });

  const createMutation = useMutation({
    mutationFn: orgApi.create,
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["admin-organizations"] });
      setForm({ name: "", domain: "", adminEmail: "", seatCount: "10" });
      setCreateOpen(false);
      setCredentials(result);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });

  const filtered = orgs?.filter(
    (o) => !q || `${o.name} ${o.domain ?? ""} ${o.adminEmail}`.toLowerCase().includes(q.toLowerCase()),
  );

  const stats = [
    { icon: Building2, label: "Total orgs", value: orgs.length },
    { icon: Building2, label: "Active", value: orgs?.filter((o) => o.status === "ACTIVE").length ?? 0 },
    { icon: Users, label: "Total members", value: orgs?.reduce((s, o) => s + o.usedSeats, 0) ?? 0 },
    { icon: BookOpen, label: "Course assignments", value: orgs?.reduce((s, o) => s + o.assignedCourseCount, 0) ?? 0 },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6 p-6 md:p-8">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Organizations</h1>
          <p className="text-muted-foreground">Manage B2B company accounts and their private course access.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="h-4 w-4" /> New organization
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Create organization</DialogTitle>
            </DialogHeader>
            <div className="mt-2 space-y-3">
              {[
                { id: "name", label: "Organization name", placeholder: "TechCorp Inc." },
                { id: "domain", label: "Email domain (optional)", placeholder: "techcorp.io" },
                { id: "adminEmail", label: "Admin email", placeholder: "admin@techcorp.io" },
                { id: "seatCount", label: "Seats", placeholder: "10", type: "number" },
              ].map((f) => (
                <div key={f.id} className="space-y-1">
                  <Label htmlFor={f.id}>{f.label}</Label>
                  <Input
                    id={f.id}
                    type={f.type ?? "text"}
                    placeholder={f.placeholder}
                    value={form[f.id as keyof typeof form]}
                    onChange={(e) => setForm((p) => ({ ...p, [f.id]: e.target.value }))}
                  />
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                The URL slug and admin login credentials are generated automatically — you&apos;ll see the temporary password once the organization is created.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button
                  disabled={!form.name.trim() || !form.adminEmail.trim() || createMutation.isPending}
                  onClick={() => createMutation.mutate({
                    name: form.name.trim(),
                    domain: form.domain.trim() || undefined,
                    adminEmail: form.adminEmail.trim(),
                    seatCount: parseInt(form.seatCount) || 10,
                  })}
                >
                  {createMutation.isPending ? "Creating…" : "Create"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold leading-none">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="relative sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Search organizations…" className="search-input border-input bg-background pl-9 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 dark:bg-input/30" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Seats</TableHead>
                <TableHead>Courses</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">No organizations found.</TableCell>
                </TableRow>
              ) : (
                filtered?.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <div className="font-medium">{o.name}</div>
                      <div className="text-xs text-muted-foreground">{o.adminEmail}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{o.domain ?? "—"}</TableCell>
                    <TableCell className="text-sm">{o.usedSeats} / {o.seatCount}</TableCell>
                    <TableCell className="text-sm">{o.assignedCourseCount}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[o.status] ?? ""}>
                        {o.status.charAt(0) + o.status.slice(1).toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(o.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <ManageOrgCoursesDialog orgId={o.id} orgName={o.name} />
                        <PlanDialog org={o} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CredentialsPanel result={credentials} onClose={() => setCredentials(null)} />
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/endpoints";
import { UpdatePartnerSchema, type UpdatePartnerInput } from "@skillstream/shared";
import { formatUsd } from "@/lib/format";
import { StatStrip, Stat } from "@/components/shared/stat-strip";
import { useDebouncedSearch } from "@/lib/use-debounced-value";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ManagePartnerCoursesDialog } from "@/components/shared/manage-partner-courses-dialog";
import { ManagePartnerCampaignDialog } from "@/components/shared/manage-partner-campaign-dialog";
import { Link2, DollarSign, Users, Search, MoreHorizontal, PauseCircle, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { initials } from "@/lib/format";
import {
  AdminPagination,
  AdminRowsPerPage,
  ADMIN_PAGE_SIZE_OPTIONS,
} from "../../_components/admin-pagination";
import {
  AdminTableCard,
  stickyHeaderCellClass,
  stickyHeaderRowClass,
} from "../../_components/admin-table";

const statusCls: Record<string, string> = {
  APPROVED: "text-success",
  PENDING: "text-warning",
  REJECTED: "text-destructive",
  SUSPENDED: "text-muted-foreground",
};

export function PartnersTab() {
  const qc = useQueryClient();
  const [qInput, setQInput] = useState("");
  const q = useDebouncedSearch(qInput);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(ADMIN_PAGE_SIZE_OPTIONS[0]);
  const [commissionInputs, setCommissionInputs] = useState<Record<string, string>>({});

  useEffect(() => setPage(1), [q, pageSize]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "delivery-partners", { q, page, pageSize }],
    queryFn: () => adminApi.deliveryPartners({ q: q || undefined, page, pageSize }),
  });

  const partners = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  useEffect(() => {
    if (data && page > data.totalPages) setPage(data.totalPages);
  }, [data, page]);

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdatePartnerInput }) =>
      adminApi.updateDeliveryPartner(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "delivery-partners"] }),
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not update commission");
    },
  });

  const totals = {
    referrals: partners.reduce((s, a) => s + a.referralCount, 0),
    paid: partners.reduce((s, a) => s + a.paidEarningsCents, 0),
    pending: partners.reduce((s, a) => s + a.pendingEarningsCents, 0),
  };

  return (
    <>
      <StatStrip className="grid-cols-2 shrink-0 lg:grid-cols-4">
        <Stat icon={Users} label="Total partners" value={data?.total ?? "—"} tint="var(--tint-indigo)" />
        <Stat icon={Link2} label="Referrals on this page" value={totals.referrals} tint="var(--tint-sky)" />
        <Stat icon={DollarSign} label="Commissions paid" value={formatUsd(totals.paid / 100)} tint="var(--tint-emerald)" />
        <Stat icon={DollarSign} label="Pending" value={formatUsd(totals.pending / 100)} tint="var(--tint-amber)" />
      </StatStrip>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Search partners…" className="search-input border-input bg-background pl-9 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 dark:bg-input/30" />
        </div>
        <div className="ml-auto">
          <AdminRowsPerPage value={pageSize} onChange={(v) => setPageSize(v)} />
        </div>
      </div>

      <AdminTableCard className="min-h-0 flex-1" scrollClassName="h-full max-h-none">
        <Table>
          <TableHeader>
            <TableRow className={stickyHeaderRowClass}>
              <TableHead className={`pl-6 ${stickyHeaderCellClass}`}>Partner</TableHead>
              <TableHead className={stickyHeaderCellClass}>Commission</TableHead>
              <TableHead className={stickyHeaderCellClass}>Activity</TableHead>
              <TableHead className={stickyHeaderCellClass}>Status</TableHead>
              <TableHead className={`pr-6 text-right ${stickyHeaderCellClass}`}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(5)].map((__, j) => (
                    <TableCell key={j} className={j === 0 ? "pl-6" : j === 4 ? "pr-6" : ""}>
                      <div className="h-4 w-full animate-pulse rounded bg-muted" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : partners.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No delivery partners found.</TableCell>
              </TableRow>
            ) : (
              partners.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="pl-6">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-xs">{initials(a.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-sm font-medium">{a.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {a.email}{a.region ? ` · ${a.region}` : ""}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={1}
                        max={50}
                        className="h-7 w-16 text-sm"
                        value={commissionInputs[a.id] ?? a.commissionPercent}
                        onChange={(e) => setCommissionInputs((p) => ({ ...p, [a.id]: e.target.value }))}
                      />
                      <span className="text-sm">%</span>
                      {commissionInputs[a.id] !== undefined && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          disabled={updateMutation.isPending}
                          onClick={() => {
                            const result = UpdatePartnerSchema.safeParse({
                              commissionPercent: Number(commissionInputs[a.id]),
                            });
                            if (!result.success) {
                              toast.error(result.error.issues[0]?.message ?? "Commission must be between 1% and 50%");
                              return;
                            }
                            updateMutation.mutate({ id: a.id, body: result.data });
                            setCommissionInputs((p) => { const n = { ...p }; delete n[a.id]; return n; });
                            toast.success("Commission update submitted");
                          }}
                        >
                          Save
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{a.referralCount} referral{a.referralCount === 1 ? "" : "s"} · {formatUsd(a.totalEarningsCents / 100)}</div>
                    {a.pendingEarningsCents > 0 && (
                      <div className="text-xs text-muted-foreground">{formatUsd(a.pendingEarningsCents / 100)} pending</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusCls[a.status] ?? ""}>
                      {a.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <ManagePartnerCoursesDialog partnerId={a.id} partnerName={a.name} />
                      <ManagePartnerCampaignDialog partnerId={a.id} partnerName={a.name} />
                      {/* A DeliveryPartner row only ever exists as APPROVED or
                          SUSPENDED in practice (created APPROVED on review,
                          never anything else from this UI) — no empty-state
                          branch needed here. */}
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="More actions" />}>
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className={a.status === "APPROVED" ? "text-destructive" : "text-success"}
                            disabled={updateMutation.isPending}
                            onClick={() => {
                              const next = a.status === "APPROVED" ? "SUSPENDED" : "APPROVED";
                              updateMutation.mutate({ id: a.id, body: { status: next } });
                              toast.success(next === "SUSPENDED" ? "Partner suspended" : "Partner reinstated");
                            }}
                          >
                            {a.status === "APPROVED" ? <><PauseCircle /> Suspend</> : <><PlayCircle /> Reinstate</>}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </AdminTableCard>

      <div className="shrink-0 pt-2">
        <AdminPagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </>
  );
}

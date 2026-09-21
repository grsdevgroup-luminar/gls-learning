"use client";

import { useEffect, useState } from "react";
import type { DeliveryPartnerCampaignDto } from "@skillstream/shared";
import { useMyDeliveryPartner, useMyPartnerCampaigns } from "@/lib/api/delivery-partner-hooks";
import { PartnerMissingState, PartnerPageLoading, PartnerStatusState } from "../_components/partner-page-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Meter } from "@/components/shared/meter";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Megaphone, Copy, Percent, CheckCircle2, Clock3, Ban } from "lucide-react";
import { useDebouncedSearch } from "@/lib/use-debounced-value";
import {
  AdminPagination, AdminRowsPerPage, ADMIN_PAGE_SIZE_OPTIONS,
} from "@/app/admin/_components/admin-pagination";
import {
  AdminTableCard, stickyHeaderCellClass, stickyHeaderRowClass,
} from "@/app/admin/_components/admin-table";
import { toast } from "sonner";

type CampaignStatus = DeliveryPartnerCampaignDto["status"];

const statusStyle: Record<CampaignStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "text-success" },
  scheduled: { label: "Scheduled", className: "text-primary" },
  disabled: { label: "Disabled", className: "text-muted-foreground" },
  expired: { label: "Expired", className: "text-muted-foreground" },
  "limit-reached": { label: "Limit reached", className: "text-warning" },
};

export default function PartnerCampaigns() {
  const { data: partner, isLoading } = useMyDeliveryPartner();
  const { data: campaigns } = useMyPartnerCampaigns();
  const [qInput, setQInput] = useState("");
  const q = useDebouncedSearch(qInput);
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(ADMIN_PAGE_SIZE_OPTIONS[0]);

  const all = campaigns ?? [];
  const filtered = all
    .filter((c) => statusFilter === "all" || c.status === statusFilter)
    .filter((c) => !q || c.code.toLowerCase().includes(q.toLowerCase()));
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => setPage(1), [q, statusFilter, pageSize]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  if (isLoading) return <PartnerPageLoading />;
  if (!partner) return <PartnerMissingState />;
  if (partner.status !== "APPROVED") return <PartnerStatusState status={partner.status} />;

  const active = all.filter((c) => c.status === "active").length;
  const scheduled = all.filter((c) => c.status === "scheduled").length;
  const inactive = all.filter((c) => c.status === "expired" || c.status === "disabled" || c.status === "limit-reached").length;

  const stats = [
    { icon: Megaphone, label: "Total campaigns", value: all.length },
    { icon: CheckCircle2, label: "Active", value: active },
    { icon: Clock3, label: "Scheduled", value: scheduled },
    { icon: Ban, label: "Inactive / past", value: inactive },
  ];

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Campaigns</h1>
        <p className="text-muted-foreground">Every discount code an admin has set up for you to share.</p>
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-1 sm:flex-row">
          <div className="relative sm:max-w-xs sm:flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Search by code…"
              className="search-input border-input bg-background pl-9 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 dark:bg-input/30"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v as CampaignStatus | "all")}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue>
                {(value: CampaignStatus | "all") => (value === "all" ? "All statuses" : statusStyle[value].label)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectItem value="all">All statuses</SelectItem>
              {(["active", "scheduled", "limit-reached", "expired", "disabled"] as const).map((s) => (
                <SelectItem key={s} value={s}>{statusStyle[s].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <AdminRowsPerPage value={pageSize} onChange={setPageSize} />
      </div>

      <AdminTableCard>
        <Table>
          <TableHeader>
            <TableRow className={stickyHeaderRowClass}>
              <TableHead className={stickyHeaderCellClass}>Code</TableHead>
              <TableHead className={stickyHeaderCellClass}>Discount</TableHead>
              <TableHead className={stickyHeaderCellClass}>Usage</TableHead>
              <TableHead className={stickyHeaderCellClass}>Dates</TableHead>
              <TableHead className={stickyHeaderCellClass}>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {all.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                  No campaigns yet — ask an admin to set one up for you.
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                  No campaigns match this search/filter.
                </TableCell>
              </TableRow>
            ) : (
              paged.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-sm font-semibold">{c.code}</span>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Copy code"
                        onClick={() => { navigator.clipboard?.writeText(c.code); toast.success("Code copied"); }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm font-semibold">
                      <Percent className="h-3.5 w-3.5 text-primary" /> {c.discountPercent}%
                    </div>
                  </TableCell>
                  <TableCell>
                    {c.usageLimit > 0 ? (
                      <div className="flex min-w-[140px] items-center gap-2">
                        <Meter value={(c.usageCount / c.usageLimit) * 100} height={6} className="w-20" />
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {c.usageCount.toLocaleString()}/{c.usageLimit.toLocaleString()}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">{c.usageCount.toLocaleString()} · unlimited</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.startDate.slice(0, 10)} → {c.endDate.slice(0, 10)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusStyle[c.status].className}>
                      {statusStyle[c.status].label}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </AdminTableCard>

      <AdminPagination page={page} totalPages={totalPages} onPageChange={setPage} total={filtered.length} itemLabel="campaign" />
    </div>
  );
}

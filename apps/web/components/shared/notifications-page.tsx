"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, ChevronLeft, ChevronRight } from "lucide-react";
import type { NotificationDto } from "@skillstream/shared";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
} from "@/lib/api/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Row({ n }: { n: NotificationDto }) {
  const markRead = useMarkNotificationRead();
  const unread = !n.readAt;

  const body = (
    <div className="flex flex-1 items-start gap-3 p-4">
      <span
        className={cn(
          "mt-1.5 size-2 shrink-0 rounded-full",
          unread ? "bg-primary" : "bg-transparent",
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <span className={cn("truncate text-sm", unread ? "font-semibold" : "font-medium")}>
            {n.title}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatTimestamp(n.createdAt)}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
      </div>
    </div>
  );

  const handleClick = () => {
    if (unread) markRead.mutate(n.id);
  };

  return (
    <Card
      className={cn("p-0 transition-colors", unread && "bg-accent/40")}
      onClick={handleClick}
    >
      <CardContent className="p-0">
        {n.href ? (
          // Clickable rows get a hover highlight and a trailing chevron —
          // the same "this goes somewhere" affordance used for list rows
          // elsewhere (e.g. the dashboard's enrolled-courses list) — so
          // they read as distinct from purely informational notifications.
          <Link
            href={n.href}
            className="group/notif-row flex items-center transition-colors hover:bg-accent/50"
          >
            {body}
            <ChevronRight className="mr-4 size-4 shrink-0 text-muted-foreground transition-transform group-hover/notif-row:translate-x-0.5" />
          </Link>
        ) : (
          // Chevron stays in the tree but invisible — reserving the same
          // width as the clickable branch above keeps every row's timestamp
          // landing on the same right edge instead of drifting per row.
          <div className="flex cursor-default items-center">
            {body}
            <ChevronRight className="invisible mr-4 size-4 shrink-0" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Shared "view all" notifications page — rendered from a thin page.tsx in
 *  each of the five authenticated portals (student/admin/instructor/
 *  sales-agent/org), since there's no single shared route across them. */
export function NotificationsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useNotifications({ page, pageSize: PAGE_SIZE });
  const { data: unread } = useUnreadNotificationCount();
  const markAllRead = useMarkAllNotificationsRead();

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">Everything that&apos;s happened on your account.</p>
        </div>
        {(unread?.count ?? 0) > 0 && (
          <Button variant="outline" size="sm" onClick={() => markAllRead.mutate()}>
            <CheckCheck className="size-4" /> Mark all read
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((n) => (
            <Skeleton key={n} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Bell className="mx-auto mb-3 size-10 opacity-40" />
            <p className="font-medium">Nothing here yet</p>
            <p className="mt-1 text-sm">You&apos;ll see updates about your account here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {data.items.map((n) => (
            <Row key={n.id} n={n} />
          ))}
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-muted-foreground">
            Page {data.page} of {data.totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="size-4" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

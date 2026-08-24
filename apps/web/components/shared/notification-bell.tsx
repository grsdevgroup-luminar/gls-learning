"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { Bell, CheckCheck } from "lucide-react";
import type { NotificationDto } from "@skillstream/shared";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
} from "@/lib/api/hooks";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** Which portal's "view all" page to link to — derived from the URL rather
 *  than a prop, since PortalShell is one shared component across all five
 *  authenticated layouts. */
function notificationsHref(pathname: string): string {
  if (pathname.startsWith("/admin")) return "/admin/notifications";
  if (pathname.startsWith("/instructor")) return "/instructor/notifications";
  if (pathname.startsWith("/sales-agent")) return "/sales-agent/notifications";
  const org = pathname.match(/^\/org\/([^/]+)/);
  if (org) return `/org/${org[1]}/notifications`;
  return "/dashboard/notifications";
}

function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function NotificationRow({ n }: { n: NotificationDto }) {
  const unread = !n.readAt;

  const content = (
    <div className="flex w-full items-start gap-2.5 whitespace-normal">
      <span
        className={cn(
          "mt-1.5 size-1.5 shrink-0 rounded-full",
          unread ? "bg-primary" : "bg-transparent",
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{n.title}</span>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {timeAgo(n.createdAt)}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
      </div>
    </div>
  );

  return (
    <DropdownMenuItem
      className="items-start py-2"
      render={n.href ? <Link href={n.href} /> : <button type="button" />}
    >
      {content}
    </DropdownMenuItem>
  );
}

export function NotificationBell() {
  const pathname = usePathname();
  const { data: unread } = useUnreadNotificationCount();
  const { data: page, isLoading } = useNotifications({ page: 1, pageSize: 8 });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const count = unread?.count ?? 0;
  const viewedIds = useRef(new Set<string>());

  // "Viewed" counts as read here: once the dropdown is opened and the list is
  // on screen, whatever's unread in it gets marked read — no extra click
  // needed. viewedIds guards against re-firing while the read-state refetch
  // is still in flight (open/close/reopen before the list updates).
  function markVisibleAsRead(open: boolean) {
    if (!open || !page) return;
    for (const n of page.items) {
      if (n.readAt || viewedIds.current.has(n.id)) continue;
      viewedIds.current.add(n.id);
      markRead.mutate(n.id);
    }
  }

  return (
    <DropdownMenu onOpenChange={markVisibleAsRead}>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="relative shrink-0" />
        }
      >
        <Bell className="size-4.5" />
        {count > 0 && (
          <Badge className="absolute -right-1 -top-1 h-4.5 min-w-4.5 justify-center px-1 text-[10px]">
            {count > 9 ? "9+" : count}
          </Badge>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-2.5 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          {count > 0 && (
            <button
              type="button"
              onClick={() => markAllRead.mutate()}
              className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <CheckCheck className="size-3.5" /> Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator className="mx-0" />
        <ScrollArea className="max-h-96">
          {isLoading ? (
            <div className="px-2.5 py-6 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : !page || page.items.length === 0 ? (
            <div className="px-2.5 py-6 text-center text-sm text-muted-foreground">
              You&apos;re all caught up.
            </div>
          ) : (
            page.items.map((n) => <NotificationRow key={n.id} n={n} />)
          )}
        </ScrollArea>
        <DropdownMenuSeparator className="mx-0" />
        <DropdownMenuItem
          render={<Link href={notificationsHref(pathname)} />}
          className="justify-center text-sm text-muted-foreground"
        >
          View all
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

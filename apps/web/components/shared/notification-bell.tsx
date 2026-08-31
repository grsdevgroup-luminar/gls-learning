"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { ArrowRight, Bell, BellOff, CheckCheck, ChevronRight } from "lucide-react";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const PANEL_CLASS =
  "flex w-80 flex-col overflow-hidden rounded-xl border border-border/70 bg-popover p-0 shadow-2xl shadow-black/10 ring-1 ring-black/[0.04] sm:w-96 dark:shadow-black/50 dark:ring-white/5";

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

function BellTrigger({ count, size }: { count: number; size: "icon" | "icon-sm" }) {
  return (
    <DropdownMenuTrigger
      render={<Button variant="ghost" size={size} className="relative shrink-0" />}
    >
      <Bell className="size-4.5" />
      {count > 0 && (
        <Badge className="absolute -right-1 -top-1 h-4.5 min-w-4.5 justify-center rounded-full px-1 text-[10px] shadow-sm ring-2 ring-background">
          {count > 9 ? "9+" : count}
        </Badge>
      )}
    </DropdownMenuTrigger>
  );
}

function PanelHeader({
  unreadCount,
  onMarkAllRead,
}: {
  unreadCount: number;
  onMarkAllRead: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/70 bg-muted/40 px-3.5 py-2.5">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground">Notifications</span>
        {unreadCount > 0 && (
          <Badge variant="secondary" className="h-4.5 rounded-full px-1.5 text-[10px] font-semibold">
            {unreadCount} new
          </Badge>
        )}
      </div>
      {unreadCount > 0 && (
        <button
          type="button"
          onClick={onMarkAllRead}
          className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <CheckCheck className="size-3.5" /> Mark all read
        </button>
      )}
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="space-y-3 px-3.5 py-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-start gap-2.5">
          <div className="mt-1 size-1.5 shrink-0 rounded-full bg-muted" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-full animate-pulse rounded bg-muted/70" />
          </div>
        </div>
      ))}
    </div>
  );
}

function PanelEmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted">
        <BellOff className="size-4.5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">You&apos;re all caught up</p>
      <p className="text-xs text-muted-foreground">No new notifications right now.</p>
    </div>
  );
}

function NotificationRow({ n }: { n: NotificationDto }) {
  const unread = !n.readAt;

  const content = (
    // text-left guards against the non-clickable row's <button> wrapper —
    // browsers default `button` to text-align:center (unlike `a`/`div`),
    // which would otherwise shift this row's text off the shared left edge.
    <div className="relative flex w-full items-start gap-2.5 whitespace-normal text-left">
      {unread && (
        <span className="absolute inset-y-0.5 -left-1.5 w-1 rounded-full bg-primary" />
      )}
      <span
        className={cn(
          "mt-1.5 size-1.5 shrink-0 rounded-full",
          unread ? "bg-primary" : "bg-transparent",
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "truncate text-sm",
              unread ? "font-semibold text-foreground" : "font-medium text-foreground/80",
            )}
          >
            {n.title}
          </span>
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
            {timeAgo(n.createdAt)}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {n.body}
        </p>
      </div>
      {/* Chevron marks this row as a link — invisible (not omitted) when
          there's no href, so it still reserves its width. Omitting it
          entirely would let the title/timestamp row above grow into that
          space, landing timestamps at a different right edge row to row
          depending on whether a chevron happened to be present. */}
      <ChevronRight
        className={cn(
          "mt-1 size-3.5 shrink-0 self-center text-muted-foreground transition-transform group-hover/dropdown-menu-item:translate-x-0.5",
          !n.href && "invisible",
        )}
      />
    </div>
  );

  return (
    <DropdownMenuItem
      className={cn(
        "items-start rounded-lg py-2.5 pl-3 focus:bg-accent/70",
        unread && "bg-accent/40",
      )}
      // w-full is required on both: an <a> stretches to fill the row by
      // default, but a <button> doesn't — even with the same `flex` class —
      // so without it, non-clickable rows render narrower than the rest.
      render={n.href ? <Link href={n.href} className="w-full" /> : <button type="button" className="w-full" />}
    >
      {content}
    </DropdownMenuItem>
  );
}

function PanelFooter({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="group/view-all flex shrink-0 items-center justify-center gap-1.5 border-t border-border/70 bg-muted/40 px-3.5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      View all notifications
      <ArrowRight className="size-3.5 transition-transform group-hover/view-all:translate-x-0.5" />
    </Link>
  );
}

export function NotificationBell({ size = "icon" }: { size?: "icon" | "icon-sm" } = {}) {
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
      <BellTrigger count={count} size={size} />
      <DropdownMenuContent align="end" className={PANEL_CLASS}>
        <PanelHeader unreadCount={count} onMarkAllRead={() => markAllRead.mutate()} />
        {/* Capped so the panel stays compact — roughly four rows before it
            scrolls — rather than stretching to fit every one of the (up to 8)
            loaded items. min-h-0 keeps it shrinkable within the flex column;
            ScrollArea's own flex-based viewport is what makes max-h reliable
            here instead of spilling past it. */}
        <ScrollArea className="max-h-76 min-h-0 flex-1">
          {isLoading ? (
            <PanelSkeleton />
          ) : !page || page.items.length === 0 ? (
            <PanelEmptyState />
          ) : (
            <div className="space-y-0.5 p-1.5">
              {page.items.map((n) => (
                <NotificationRow key={n.id} n={n} />
              ))}
            </div>
          )}
        </ScrollArea>
        <PanelFooter href={notificationsHref(pathname)} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

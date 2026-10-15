"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, CalendarDays, HeadphonesIcon, Package } from "lucide-react";
import { markNotificationsSeen } from "@/lib/notifications/actions";
import { useNotificationSync } from "@/hooks/use-notification-sync";
import { cn, formatRelative } from "@/lib/utils";

const ICON_BY_TYPE: Record<string, typeof Bell> = {
  TICKET_STATUS_CHANGED: HeadphonesIcon,
  LOW_STOCK: Package,
  NEW_BOOKING: CalendarDays,
};

/**
 * The real notification bell — replaces the two dead ones (a static `<div>`
 * in `SidebarFooter`, a `<button>` with no handler on the cashier dashboard).
 * Polls `/api/notifications`; opening the panel marks the cursor seen.
 */
export function NotificationBell({
  panelPosition = "down",
  variant = "row",
}: {
  /** "up" for a bell pinned near the bottom of the screen (the sidebar
   * footer) so the panel doesn't open off-screen; "down" everywhere else. */
  panelPosition?: "up" | "down";
  /** "row": full-width with a label, for the sidebar footer. "icon": a
   * compact circular button, for a topbar. */
  variant?: "row" | "icon";
}) {
  const { notifications, unreadCount } = useNotificationSync();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) void markNotificationsSeen();
  }

  return (
    <div ref={rootRef} className="relative">
      {variant === "icon" ? (
        <button
          type="button"
          onClick={toggle}
          aria-label="Notifications"
          className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg-muted)] text-[var(--text-muted)] transition hover:text-[var(--text)]"
        >
          <Bell className="h-4.5 w-4.5" />
          {unreadCount > 0 && (
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[var(--danger)]" />
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={toggle}
          aria-label="Notifications"
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-[var(--text-muted)] transition hover:bg-[var(--bg-muted)] hover:text-[var(--text)]"
        >
          <Bell className="h-4 w-4" />
          Notifications
          {unreadCount > 0 && (
            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-md bg-[var(--gold)]/20 px-1.5 text-xs text-[var(--gold-soft)]">
              {unreadCount}
            </span>
          )}
        </button>
      )}

      {open && (
        <div
          className={cn(
            "absolute z-50 max-h-96 w-80 overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-2 shadow-[var(--shadow)]",
            variant === "icon" ? "right-0" : "left-0",
            panelPosition === "up" ? "bottom-full mb-2" : "top-full mt-2",
          )}
        >
          {notifications.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-[var(--text-muted)]">
              Nothing yet
            </p>
          ) : (
            notifications.map((n) => {
              const Icon = ICON_BY_TYPE[n.type] ?? Bell;
              return (
                <div
                  key={n.id}
                  className={cn(
                    "flex gap-3 rounded-xl px-3 py-2.5 text-left",
                    "hover:bg-[var(--bg-muted)]",
                  )}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--gold)]/15">
                    <Icon className="h-4 w-4 text-[var(--gold-soft)]" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{n.title}</p>
                    {n.body && (
                      <p className="truncate text-xs text-[var(--text-muted)]">{n.body}</p>
                    )}
                    <p className="text-xs text-[var(--text-faint)]">
                      {formatRelative(n.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

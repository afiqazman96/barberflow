"use client";

import { useEffect, useState } from "react";
import { fetchNotificationSnapshot, type NotificationSnapshot } from "@/lib/notifications/client";

const POLL_MS = 30_000;

/**
 * Polls the signed-in staff member's notifications. Deliberately not the
 * Realtime-broadcast-then-refetch machinery `useQueueSync` uses — that's
 * shaped for "replace current state" snapshots (today's queue, today's
 * bookings), the wrong fit for an appendable, per-viewer-read feed.
 */
export function useNotificationSync() {
  const [snapshot, setSnapshot] = useState<NotificationSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    function load() {
      fetchNotificationSnapshot().then((result) => {
        if (!cancelled && result) setSnapshot(result);
      });
    }
    load();
    const poll = setInterval(load, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return {
    notifications: snapshot?.notifications ?? [],
    unreadCount: snapshot?.unreadCount ?? 0,
  };
}

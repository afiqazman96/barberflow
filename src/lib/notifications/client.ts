import type { NotificationRow } from "./queries";

export type NotificationSnapshot = {
  notifications: NotificationRow[];
  unreadCount: number;
};

export async function fetchNotificationSnapshot(): Promise<NotificationSnapshot | null> {
  try {
    const response = await fetch("/api/notifications", { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as NotificationSnapshot;
  } catch {
    return null;
  }
}

import type { Sale } from "@/lib/types";
import { DAY_SHORT, localIso } from "@/lib/roster";

/** Revenue per day for the last `days` days ending today. */
export function weeklyTrend(
  sales: Sale[],
  now: Date,
  days = 7,
): { day: string; sales: number }[] {
  const out: { day: string; sales: number; iso: string }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    out.push({ day: DAY_SHORT[d.getDay()], sales: 0, iso: localIso(d) });
  }
  for (const s of sales) {
    if (s.voided) continue;
    const slot = out.find((o) => o.iso === localIso(new Date(s.createdAt)));
    if (slot) slot.sales += s.total;
  }
  return out.map(({ day, sales: v }) => ({ day, sales: Math.round(v * 100) / 100 }));
}

/** Services ranked by how many were sold. */
export function topServices(
  sales: Sale[],
  limit = 5,
): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const s of sales) {
    if (s.voided) continue;
    for (const item of s.items) {
      if (item.type !== "service") continue;
      counts.set(item.name, (counts.get(item.name) ?? 0) + item.quantity);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Number of sales rung up in each trading hour. */
export function peakHours(
  sales: Sale[],
  from = 10,
  to = 21,
): { hour: string; count: number }[] {
  const buckets = new Map<number, number>();
  for (let h = from; h <= to; h++) buckets.set(h, 0);
  for (const s of sales) {
    if (s.voided) continue;
    const h = new Date(s.createdAt).getHours();
    if (buckets.has(h)) buckets.set(h, (buckets.get(h) ?? 0) + 1);
  }
  return [...buckets.entries()].map(([h, count]) => ({ hour: String(h), count }));
}

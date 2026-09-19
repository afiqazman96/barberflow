import type { LeaveEntry, RosterDay, ShiftRecord } from "@/lib/types";
import { atLocal, hhmmToMins, localIso, minsOfDay } from "@/lib/roster";
import { STAFF } from "./data";

const work = (start: string, end: string): RosterDay => ({ off: false, start, end });
const rest: RosterDay = { off: true, start: "10:00", end: "19:00" };

/** Weekly rosters, index 0 = Sunday. The owner isn't rostered. */
export const ROSTER: Record<string, RosterDay[]> = {
  c1: [rest, ...Array.from({ length: 6 }, () => work("10:00", "19:00"))],
  s1: [rest, ...Array.from({ length: 6 }, () => work("10:00", "19:00"))],
  s2: [work("11:00", "20:00"), rest, rest, work("11:00", "20:00"), work("11:00", "20:00"), work("11:00", "20:00"), work("11:00", "20:00")],
  s3: [work("12:00", "21:00"), work("12:00", "21:00"), rest, rest, work("12:00", "21:00"), work("12:00", "21:00"), work("12:00", "21:00")],
};

function isoOffset(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return localIso(d);
}

export const LEAVES: LeaveEntry[] = [
  { id: "lv1", staffId: "s2", date: isoOffset(-3), reason: "Sick (MC)" },
  { id: "lv2", staffId: "s1", date: isoOffset(5), reason: "Annual leave" },
];

const LATE = [0, 4, 12, 0, 25, 3];
const OVER = [0, 10, -5, 0, 15, 5];
const addMins = (d: Date, m: number) => new Date(d.getTime() + m * 60000);

function build(): ShiftRecord[] {
  const now = new Date();
  const out: ShiftRecord[] = [];
  const tracked = STAFF.filter((s) => s.role !== "owner");
  tracked.forEach((m, si) => {
    // Past six days of finished shifts, on the days they were rostered.
    for (let back = 6; back >= 1; back--) {
      const iso = isoOffset(-back);
      const day = ROSTER[m.id]?.[new Date(`${iso}T00:00:00`).getDay()];
      if (!day || day.off || LEAVES.some((l) => l.staffId === m.id && l.date === iso)) continue;
      const k = (back + si) % LATE.length;
      const start = addMins(atLocal(iso, day.start), LATE[k]);
      const end = addMins(atLocal(iso, day.end), OVER[k]);
      out.push({
        id: `sh-seed-${m.id}-${iso}`,
        staffId: m.id,
        branchId: m.branchId,
        date: iso,
        startedAt: start.toISOString(),
        endedAt: end.toISOString(),
        chairId: m.role === "barber" ? m.chairId : null,
        startedBy: "self",
        endedBy: "self",
      });
    }
    // Anyone the seed data shows as on duty right now has an open shift.
    if (m.status !== "off-duty") {
      const iso = localIso(now);
      const day = ROSTER[m.id]?.[now.getDay()];
      const sched = day && !day.off ? hhmmToMins(day.start) : minsOfDay(now) - 30;
      const at = Math.min(sched + (si % 2 === 0 ? 3 : 0), minsOfDay(now) - 1);
      const started = atLocal(iso, "00:00");
      started.setMinutes(Math.max(0, at));
      out.push({
        id: `sh-seed-${m.id}-${iso}`,
        staffId: m.id,
        branchId: m.branchId,
        date: iso,
        startedAt: started.toISOString(),
        chairId: m.role === "barber" ? m.chairId : null,
        startedBy: "self",
      });
    }
  });
  return out.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export const SHIFTS: ShiftRecord[] = build();

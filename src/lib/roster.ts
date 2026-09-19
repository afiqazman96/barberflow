import type {
  Branch,
  LeaveEntry,
  RosterDay,
  ShiftRecord,
  StaffMember,
} from "@/lib/types";

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;
export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Minutes past the scheduled start before someone counts as late. */
export const LATE_GRACE_MINS = 10;
/** Minutes past closing before a forgotten shift is closed automatically. */
export const AUTO_CLOSE_GRACE_MINS = 30;

export function localIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Parses a YYYY-MM-DD string as a local date (never UTC). */
export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function weekdayOf(iso: string): number {
  return parseIso(iso).getDay();
}

export function hhmmToMins(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function minsOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function atLocal(iso: string, hhmm: string): Date {
  const d = parseIso(iso);
  d.setHours(0, hhmm ? hhmmToMins(hhmm) : 0, 0, 0);
  return d;
}

export function formatClock(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-MY", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function formatHhmm(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(2000, 0, 1, h, m || 0);
  return formatClock(d);
}

export function formatDuration(mins: number): string {
  const m = Math.max(0, Math.round(mins));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}m`;
  return r === 0 ? `${h}h` : `${h}h ${r}m`;
}

/** Closing time of a branch as minutes past midnight, from "10:00 – 22:00". */
export function closingMins(branch?: Pick<Branch, "openHours">): number {
  const m = branch?.openHours.match(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/);
  return m ? Number(m[3]) * 60 + Number(m[4]) : 23 * 60 + 59;
}

export function rosterFor(
  roster: Record<string, RosterDay[]>,
  staffId: string,
  iso: string,
): RosterDay | undefined {
  return roster[staffId]?.[weekdayOf(iso)];
}

export function leaveOn(
  leaves: LeaveEntry[],
  staffId: string,
  iso: string,
): LeaveEntry | undefined {
  return leaves.find((l) => l.staffId === staffId && l.date === iso);
}

/** Whether the roster has this person working that date (and not on leave). */
export function isRosteredOn(
  roster: Record<string, RosterDay[]>,
  leaves: LeaveEntry[],
  staffId: string,
  iso: string,
): boolean {
  const day = rosterFor(roster, staffId, iso);
  return !!day && !day.off && !leaveOn(leaves, staffId, iso);
}

export function openShiftOf(
  shifts: ShiftRecord[],
  staffId: string,
): ShiftRecord | undefined {
  return shifts.find((s) => s.staffId === staffId && !s.endedAt);
}

export function shiftMins(shift: ShiftRecord, now: Date): number {
  const end = shift.endedAt ? new Date(shift.endedAt) : now;
  return Math.max(0, (end.getTime() - new Date(shift.startedAt).getTime()) / 60000);
}

export type AttendanceState =
  | "on-shift"
  | "done"
  | "late"
  | "upcoming"
  | "rest"
  | "leave"
  | "unrostered";

export interface Attendance {
  state: AttendanceState;
  label: string;
  tone: "success" | "warning" | "danger" | "default" | "info";
  scheduled?: RosterDay;
  shift?: ShiftRecord;
  /** Minutes past scheduled start they clocked in, when that was late. */
  lateMins: number;
  /** Clocked in on a rest day, leave day or with no roster at all. */
  unscheduled: boolean;
}

/** Roster vs. reality for one staff member on one date. */
export function attendanceFor(args: {
  staffId: string;
  roster: Record<string, RosterDay[]>;
  leaves: LeaveEntry[];
  shifts: ShiftRecord[];
  now: Date;
}): Attendance {
  const { staffId, roster, leaves, shifts, now } = args;
  const today = localIso(now);
  const todays = shifts
    .filter((s) => s.staffId === staffId && s.date === today)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const open = todays.find((s) => !s.endedAt);
  const first = todays[0];
  const shift = open ?? todays[todays.length - 1];
  const day = rosterFor(roster, staffId, today);
  const leave = leaveOn(leaves, staffId, today);
  const working = !!day && !day.off && !leave;

  let lateMins = 0;
  if (first && working && day) {
    lateMins = Math.max(
      0,
      Math.round(
        (new Date(first.startedAt).getTime() - atLocal(today, day.start).getTime()) /
          60000,
      ),
    );
    if (lateMins <= LATE_GRACE_MINS) lateMins = 0;
  }
  const unscheduled = !!first && !working;
  const base = { scheduled: day, shift, lateMins, unscheduled };

  if (open) {
    return {
      ...base,
      state: "on-shift",
      label: lateMins
        ? `On shift · in ${lateMins}m late`
        : unscheduled
          ? "On shift · not rostered"
          : "On shift",
      tone: lateMins || unscheduled ? "warning" : "success",
    };
  }
  if (first) {
    return { ...base, state: "done", label: "Shift ended", tone: "default" };
  }
  if (leave) {
    return { ...base, state: "leave", label: `On leave · ${leave.reason}`, tone: "info" };
  }
  if (!day) {
    return { ...base, state: "unrostered", label: "No roster set", tone: "default" };
  }
  if (day.off) {
    return { ...base, state: "rest", label: "Rest day", tone: "default" };
  }
  const startMins = hhmmToMins(day.start);
  const nowMins = minsOfDay(now);
  if (nowMins >= startMins + LATE_GRACE_MINS) {
    return {
      ...base,
      state: "late",
      label: `Not in · ${formatDuration(nowMins - startMins)} late`,
      tone: "danger",
    };
  }
  return {
    ...base,
    state: "upcoming",
    label: `Starts ${formatHhmm(day.start)}`,
    tone: "default",
  };
}

export function isTrackedRole(role: StaffMember["role"]): boolean {
  return role !== "owner";
}

export function emptyWeek(): RosterDay[] {
  return DAY_NAMES.map(() => ({ off: true, start: "10:00", end: "19:00" }));
}

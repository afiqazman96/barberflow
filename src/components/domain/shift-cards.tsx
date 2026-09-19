"use client";

import { CalendarClock, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useNow } from "@/hooks/use-now";
import { useAppStore } from "@/lib/store/app-store";
import {
  DAY_SHORT,
  attendanceFor,
  formatClock,
  formatDuration,
  formatHhmm,
  leaveOn,
  localIso,
  rosterFor,
  shiftMins,
} from "@/lib/roster";
import { cn, formatDate } from "@/lib/utils";

/** Today at a glance: what the roster says, and what actually happened. */
export function MyShiftCard({ staffId }: { staffId: string }) {
  const now = useNow();
  const roster = useAppStore((s) => s.roster);
  const leaves = useAppStore((s) => s.leaves);
  const shifts = useAppStore((s) => s.shifts);

  if (!now) return <Card className="h-28 animate-pulse" />;

  const a = attendanceFor({ staffId, roster, leaves, shifts, now });
  const sched = a.scheduled && !a.scheduled.off ? a.scheduled : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-[var(--gold)]" />
          Today&apos;s shift
        </CardTitle>
        <Badge variant={a.tone}>{a.label}</Badge>
      </CardHeader>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-[var(--bg-muted)] p-3">
          <p className="text-xs text-[var(--text-faint)]">Rostered</p>
          <p className="font-medium">
            {sched
              ? `${formatHhmm(sched.start)} – ${formatHhmm(sched.end)}`
              : a.state === "leave"
                ? "On leave"
                : "Rest day"}
          </p>
        </div>
        <div className="rounded-xl bg-[var(--bg-muted)] p-3">
          <p className="text-xs text-[var(--text-faint)]">Clocked in</p>
          <p className="font-medium">
            {a.shift
              ? `${formatClock(a.shift.startedAt)}${
                  a.shift.endedAt ? ` – ${formatClock(a.shift.endedAt)}` : ""
                }`
              : "—"}
          </p>
        </div>
      </div>
      {a.shift && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
          <Clock className="h-3.5 w-3.5" />
          {formatDuration(shiftMins(a.shift, now))} {a.shift.endedAt ? "worked" : "so far"}
          {a.shift.startedBy === "owner" && " · clocked in by owner"}
          {a.shift.endedBy === "owner" && " · clocked out by owner"}
          {a.shift.endedBy === "auto" && " · auto-closed"}
        </p>
      )}
    </Card>
  );
}

/** Next seven days from the roster, today first. */
export function WeekSchedule({ staffId }: { staffId: string }) {
  const now = useNow();
  const roster = useAppStore((s) => s.roster);
  const leaves = useAppStore((s) => s.leaves);

  if (!now) return <Card className="h-56 animate-pulse" />;

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const iso = localIso(d);
    return { i, d, iso, day: rosterFor(roster, staffId, iso), leave: leaveOn(leaves, staffId, iso) };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-[var(--gold)]" />
          My week
        </CardTitle>
      </CardHeader>
      <div className="divide-y divide-[var(--border)]">
        {days.map(({ i, d, iso, day, leave }) => (
          <div
            key={iso}
            className={cn(
              "flex items-center justify-between py-2.5 text-sm",
              i === 0 && "font-medium",
            )}
          >
            <span className="flex items-center gap-2">
              <span className="w-9 text-[var(--text-muted)]">{DAY_SHORT[d.getDay()]}</span>
              <span className="text-xs text-[var(--text-faint)]">{formatDate(iso)}</span>
              {i === 0 && <Badge variant="gold">Today</Badge>}
            </span>
            <span
              className={cn(
                leave
                  ? "text-[var(--info)]"
                  : !day || day.off
                    ? "text-[var(--text-faint)]"
                    : "text-[var(--text)]",
              )}
            >
              {leave
                ? `Leave · ${leave.reason}`
                : !day
                  ? "Not set"
                  : day.off
                    ? "Rest day"
                    : `${formatHhmm(day.start)} – ${formatHhmm(day.end)}`}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/** Finished shifts, newest first. */
export function RecentShifts({ staffId, limit = 6 }: { staffId: string; limit?: number }) {
  const shifts = useAppStore((s) => s.shifts);
  const rows = shifts
    .filter((s) => s.staffId === staffId && s.endedAt)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, limit);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-[var(--gold)]" />
          Recent shifts
        </CardTitle>
      </CardHeader>
      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-[var(--text-muted)]">No shifts yet.</p>
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between py-2.5 text-sm">
              <span>
                <span className="block">{formatDate(r.date)}</span>
                <span className="text-xs text-[var(--text-faint)]">
                  {formatClock(r.startedAt)} – {formatClock(r.endedAt!)}
                </span>
              </span>
              <span className="text-right">
                <span className="block font-medium">
                  {formatDuration(shiftMins(r, new Date(r.endedAt!)))}
                </span>
                {r.endedBy && r.endedBy !== "self" && (
                  <span className="text-xs text-[var(--text-faint)]">
                    {r.endedBy === "auto" ? "auto-closed" : "closed by owner"}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

"use client";

import { useConfirm } from "@/hooks/use-confirm";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CalendarOff,
  ClipboardList,
  Clock,
  LogIn,
  LogOut,
  Plus,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/app-shell";
import { PageTransition } from "@/components/layout/page-transition";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useNow } from "@/hooks/use-now";
import {
  DAY_NAMES,
  DAY_SHORT,
  LATE_GRACE_MINS,
  atLocal,
  attendanceFor,
  formatClock,
  formatDuration,
  formatHhmm,
  localIso,
  openShiftOf,
  rosterFor,
  shiftMins,
} from "@/lib/roster";
import { useAppStore } from "@/lib/store/app-store";
import type { ShiftRecord, StaffMember } from "@/lib/types";
import { cn, formatDate, initials } from "@/lib/utils";

type Tab = "today" | "roster" | "leave" | "log";

const TABS: { id: Tab; label: string; icon: typeof Clock }[] = [
  { id: "today", label: "Today", icon: UserCheck },
  { id: "roster", label: "Weekly roster", icon: CalendarClock },
  { id: "leave", label: "Leave", icon: CalendarOff },
  { id: "log", label: "Shift log", icon: ClipboardList },
];

// Monday first, the way a shop reads its week.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const OVERRIDE_REASONS = [
  "Forgot to clock in",
  "Phone or app problem",
  "Left early",
  "Emergency",
  "Shop closed early",
];

const LEAVE_REASONS = ["Annual leave", "Sick (MC)", "Emergency", "Unpaid leave", "Other"];

export default function OwnerRosterPage() {
  const confirm = useConfirm();
  const now = useNow();
  const branchId = useAppStore((s) => s.branchId);
  const branches = useAppStore((s) => s.branches);
  const allStaff = useAppStore((s) => s.staff);
  const chairs = useAppStore((s) => s.chairs);
  const shifts = useAppStore((s) => s.shifts);
  const roster = useAppStore((s) => s.roster);
  const leaves = useAppStore((s) => s.leaves);
  const startShift = useAppStore((s) => s.startShift);
  const endShift = useAppStore((s) => s.endShift);
  const closeStaleShifts = useAppStore((s) => s.closeStaleShifts);
  const setRosterDay = useAppStore((s) => s.setRosterDay);
  const addLeave = useAppStore((s) => s.addLeave);
  const removeLeave = useAppStore((s) => s.removeLeave);

  const [tab, setTab] = useState<Tab>("today");
  const [override, setOverride] = useState<{
    staff: StaffMember;
    mode: "start" | "end";
  } | null>(null);
  const [reason, setReason] = useState("");
  const [chairId, setChairId] = useState("");
  const [logStaff, setLogStaff] = useState("all");
  const [leaveForm, setLeaveForm] = useState({
    staffId: "",
    date: "",
    reason: LEAVE_REASONS[0],
  });

  useEffect(() => {
    if (now) closeStaleShifts(now);
  }, [now, closeStaleShifts]);

  const branch = branches.find((b) => b.id === branchId);
  const team = useMemo(
    () =>
      allStaff.filter(
        (s) => s.role !== "owner" && s.active && s.branchId === branchId,
      ),
    [allStaff, branchId],
  );
  const nameOf = (id: string) => allStaff.find((s) => s.id === id)?.name ?? "Unknown";

  const rows = useMemo(
    () =>
      now
        ? team.map((m) => ({
            m,
            a: attendanceFor({ staffId: m.id, roster, leaves, shifts, now }),
          }))
        : [],
    [team, roster, leaves, shifts, now],
  );

  const onShift = rows.filter((r) => r.a.state === "on-shift").length;
  const problems = rows.filter(
    (r) => r.a.state === "late" || (r.a.state === "on-shift" && r.a.lateMins > 0),
  ).length;
  const away = rows.filter((r) => r.a.state === "rest" || r.a.state === "leave").length;
  const unscheduled = rows.filter((r) => r.a.unscheduled).length;

  function openOverride(m: StaffMember, mode: "start" | "end") {
    setOverride({ staff: m, mode });
    setReason("");
    setChairId(m.chairId ?? "");
  }

  function confirmOverride() {
    if (!override) return;
    if (!reason) {
      toast.error("Pick a reason so the log stays honest");
      return;
    }
    const { staff: m, mode } = override;
    const res =
      mode === "start"
        ? startShift(m.id, { by: "owner", note: reason, chairId: chairId || null })
        : endShift(m.id, { by: "owner", note: reason });
    if (!res.ok) {
      toast.error(mode === "start" ? "Couldn't clock in" : "Couldn't end the shift", {
        description: res.error,
      });
      return;
    }
    toast.success(mode === "start" ? "Clocked in" : "Shift ended", {
      description: `${m.name} · ${reason}`,
    });
    setOverride(null);
  }

  function handleAddLeave(e: React.FormEvent) {
    e.preventDefault();
    if (!leaveForm.staffId || !leaveForm.date) {
      toast.error("Pick a person and a date");
      return;
    }
    addLeave({
      staffId: leaveForm.staffId,
      date: leaveForm.date,
      reason: leaveForm.reason,
    });
    toast.success("Leave added", {
      description: `${nameOf(leaveForm.staffId)} · ${formatDate(leaveForm.date)}`,
    });
    setLeaveForm((f) => ({ ...f, date: "" }));
  }

  const todayIso = now ? localIso(now) : "";
  const teamIds = new Set(team.map((t) => t.id));
  const branchLeaves = leaves
    .filter((l) => teamIds.has(l.staffId))
    .sort((a, b) => b.date.localeCompare(a.date));

  const log = shifts
    .filter((s) => s.branchId === branchId && (logStaff === "all" || s.staffId === logStaff))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, 40);

  function lateMinsFor(sh: ShiftRecord): number {
    // Only the first clock-in of the day can be late — later ones are re-entries.
    const firstOfDay = shifts
      .filter((x) => x.staffId === sh.staffId && x.date === sh.date)
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt))[0];
    if (firstOfDay?.id !== sh.id) return 0;
    const day = rosterFor(roster, sh.staffId, sh.date);
    if (!day || day.off) return 0;
    const diff = Math.round(
      (new Date(sh.startedAt).getTime() - atLocal(sh.date, day.start).getTime()) / 60000,
    );
    return diff > LATE_GRACE_MINS ? diff : 0;
  }

  return (
    <>
      {confirm.node}
      <Topbar
        title="Roster & Attendance"
        actions={
          <span className="hidden text-xs text-[var(--text-faint)] sm:block">
            {branch?.name}
          </span>
        }
      />
      <PageTransition>
        <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
          <div className="flex flex-wrap gap-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition",
                  tab === t.id
                    ? "bg-[var(--gold)]/15 text-[var(--gold-soft)] ring-1 ring-[var(--gold)]/30"
                    : "bg-[var(--bg-muted)] text-[var(--text-muted)] hover:text-[var(--text)]",
                )}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </button>
            ))}
          </div>

          {tab === "today" && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <Card className="p-4">
                  <p className="text-xs text-[var(--text-faint)]">On shift</p>
                  <p className="font-display text-2xl font-semibold text-[var(--success)]">
                    {now ? onShift : "–"}
                    <span className="text-sm font-normal text-[var(--text-faint)]">
                      {" "}
                      / {team.length}
                    </span>
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-[var(--text-faint)]">Late or not in</p>
                  <p className="font-display text-2xl font-semibold text-[var(--danger)]">
                    {now ? problems : "–"}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-[var(--text-faint)]">Rest day or leave</p>
                  <p className="font-display text-2xl font-semibold">{now ? away : "–"}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-[var(--text-faint)]">Unscheduled today</p>
                  <p className="font-display text-2xl font-semibold text-[var(--warning)]">
                    {now ? unscheduled : "–"}
                  </p>
                </Card>
              </div>

              {!now && <Card className="h-40 animate-pulse" />}
              {now && team.length === 0 && (
                <Card className="py-10 text-center text-sm text-[var(--text-muted)]">
                  No barbers or cashiers at this branch yet.
                </Card>
              )}
              <div className="space-y-3">
                {rows.map(({ m, a }) => {
                  const open = openShiftOf(shifts, m.id);
                  const sched = a.scheduled && !a.scheduled.off ? a.scheduled : undefined;
                  return (
                    <Card key={m.id} className="p-4">
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--gold)]/20 font-display text-sm font-semibold text-[var(--gold-soft)]">
                            {initials(m.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{m.name}</p>
                            <p className="text-xs text-[var(--text-muted)]">
                              <span className="capitalize">{m.role}</span> ·{" "}
                              {sched
                                ? `${formatHhmm(sched.start)} – ${formatHhmm(sched.end)}`
                                : a.state === "leave"
                                  ? "On leave"
                                  : "Not rostered"}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-start gap-1 sm:items-end">
                          <div className="flex items-center gap-2">
                            {open && <StatusBadge status={m.status} />}
                            <Badge variant={a.tone}>{a.label}</Badge>
                          </div>
                          {a.shift && (
                            <p className="text-xs text-[var(--text-faint)]">
                              In {formatClock(a.shift.startedAt)}
                              {a.shift.endedAt && ` · out ${formatClock(a.shift.endedAt)}`} ·{" "}
                              {formatDuration(shiftMins(a.shift, now!))}
                              {a.shift.startedBy === "owner" && " · by owner"}
                            </p>
                          )}
                        </div>
                        {open ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openOverride(m, "end")}
                          >
                            <LogOut className="h-4 w-4" />
                            End shift
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openOverride(m, "start")}
                          >
                            <LogIn className="h-4 w-4" />
                            Clock in for them
                          </Button>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
              <p className="text-xs text-[var(--text-faint)]">
                Staff clock themselves in from their own login. Use the buttons only when
                they can&apos;t — a reason is required and shows up in the shift log.
              </p>
            </div>
          )}

          {tab === "roster" && (
            <Card className="overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3 text-xs text-[var(--text-muted)]">
                <span>The recurring week for each person. Changes save instantly.</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wider text-[var(--text-faint)]">
                      <th className="px-4 py-3 font-medium">Staff</th>
                      {WEEK_ORDER.map((d) => (
                        <th key={d} className="px-2 py-3 font-medium">
                          {DAY_SHORT[d]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {team.map((m) => (
                      <tr key={m.id} className="border-b border-[var(--border)] last:border-0">
                        <td className="px-4 py-3">
                          <p className="font-medium">{m.name}</p>
                          <p className="text-xs capitalize text-[var(--text-faint)]">{m.role}</p>
                        </td>
                        {WEEK_ORDER.map((d) => {
                          const day = roster[m.id]?.[d];
                          const off = !day || day.off;
                          return (
                            <td key={d} className="px-2 py-2 align-top">
                              <button
                                type="button"
                                aria-label={`${m.name} ${DAY_NAMES[d]} ${off ? "off, click to set working" : "working, click to set off"}`}
                                onClick={() => {
                                  setRosterDay(m.id, d, {
                                    off: !off,
                                    start: day?.start ?? "10:00",
                                    end: day?.end ?? "19:00",
                                  });
                                }}
                                className={cn(
                                  "mb-1 w-full rounded-lg px-2 py-1 text-xs font-medium transition",
                                  off
                                    ? "bg-[var(--bg-muted)] text-[var(--text-faint)]"
                                    : "bg-[var(--success)]/15 text-[var(--success)]",
                                )}
                              >
                                {off ? "Off" : "Working"}
                              </button>
                              {!off && day && (
                                <div className="space-y-1">
                                  <Input
                                    type="time"
                                    aria-label={`${m.name} ${DAY_NAMES[d]} start`}
                                    value={day.start}
                                    onChange={(e) =>
                                      e.target.value &&
                                      setRosterDay(m.id, d, { start: e.target.value })
                                    }
                                    className="h-8 px-1.5 text-xs"
                                  />
                                  <Input
                                    type="time"
                                    aria-label={`${m.name} ${DAY_NAMES[d]} end`}
                                    value={day.end}
                                    onChange={(e) =>
                                      e.target.value &&
                                      setRosterDay(m.id, d, { end: e.target.value })
                                    }
                                    className="h-8 px-1.5 text-xs"
                                  />
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {tab === "leave" && (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,360px)_1fr]">
              <Card className="p-4">
                <p className="mb-3 font-display text-sm font-semibold">Add leave</p>
                <form onSubmit={handleAddLeave} className="space-y-3">
                  <div>
                    <Label htmlFor="lv-staff">Who</Label>
                    <Select
                      id="lv-staff"
                      value={leaveForm.staffId}
                      onChange={(e) => setLeaveForm((f) => ({ ...f, staffId: e.target.value }))}
                    >
                      <option value="">Select…</option>
                      {team.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="lv-date">Date</Label>
                    <Input
                      id="lv-date"
                      type="date"
                      min={todayIso || undefined}
                      value={leaveForm.date}
                      onChange={(e) => setLeaveForm((f) => ({ ...f, date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="lv-reason">Reason</Label>
                    <Select
                      id="lv-reason"
                      value={leaveForm.reason}
                      onChange={(e) => setLeaveForm((f) => ({ ...f, reason: e.target.value }))}
                    >
                      {LEAVE_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Button type="submit" className="w-full">
                    <Plus className="h-4 w-4" />
                    Add leave
                  </Button>
                </form>
              </Card>
              <Card className="p-4">
                <p className="mb-3 font-display text-sm font-semibold">Leave calendar</p>
                {branchLeaves.length === 0 ? (
                  <p className="py-6 text-center text-sm text-[var(--text-muted)]">
                    No leave recorded.
                  </p>
                ) : (
                  <div className="divide-y divide-[var(--border)]">
                    {branchLeaves.map((l) => (
                      <div
                        key={l.id}
                        className={cn(
                          "flex items-center justify-between py-2.5 text-sm",
                          todayIso && l.date < todayIso && "opacity-50",
                        )}
                      >
                        <span>
                          <span className="font-medium">{nameOf(l.staffId)}</span>
                          <span className="text-[var(--text-muted)]">
                            {" "}
                            · {formatDate(l.date)} · {l.reason}
                          </span>
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Remove leave"
                          onClick={() =>
                            confirm.ask({
                              title: "Remove this leave?",
                              description: `${l.reason} · ${formatDate(l.date)}`,
                              confirmLabel: "Remove",
                              run: () => removeLeave(l.id),
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4 text-[var(--danger)]" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {tab === "log" && (
            <Card className="overflow-hidden p-0">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
                <span className="text-xs text-[var(--text-muted)]">Latest 40 shifts</span>
                <Select
                  value={logStaff}
                  onChange={(e) => setLogStaff(e.target.value)}
                  className="h-9 w-48 text-xs"
                  aria-label="Filter by staff"
                >
                  <option value="all">Everyone</option>
                  {team.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wider text-[var(--text-faint)]">
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-2 py-3 font-medium">Staff</th>
                      <th className="px-2 py-3 font-medium">In</th>
                      <th className="px-2 py-3 font-medium">Out</th>
                      <th className="px-2 py-3 font-medium">Hours</th>
                      <th className="px-2 py-3 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {log.map((sh) => {
                      const late = lateMinsFor(sh);
                      const day = rosterFor(roster, sh.staffId, sh.date);
                      const flags = [
                        late > 0 && `${late}m late`,
                        (!day || day.off) && "not rostered",
                        sh.startedBy === "owner" && "clocked in by owner",
                        sh.endedBy === "owner" && "ended by owner",
                        sh.endedBy === "auto" && "auto-closed",
                        sh.endedBy !== "auto" && sh.note,
                      ].filter(Boolean);
                      return (
                        <tr key={sh.id} className="border-b border-[var(--border)] last:border-0">
                          <td className="px-4 py-2.5">{formatDate(sh.date)}</td>
                          <td className="px-2 py-2.5">{nameOf(sh.staffId)}</td>
                          <td className="px-2 py-2.5">{formatClock(sh.startedAt)}</td>
                          <td className="px-2 py-2.5">
                            {sh.endedAt ? formatClock(sh.endedAt) : <Badge variant="success">Open</Badge>}
                          </td>
                          <td className="px-2 py-2.5">
                            {now ? formatDuration(shiftMins(sh, now)) : "–"}
                          </td>
                          <td className="px-2 py-2.5 text-xs text-[var(--text-muted)]">
                            {flags.length ? [...new Set(flags)].join(" · ") : "—"}
                          </td>
                        </tr>
                      );
                    })}
                    {log.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-[var(--text-muted)]">
                          No shifts recorded.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </PageTransition>

      <Modal
        open={!!override}
        onOpenChange={(o) => !o && setOverride(null)}
        title={
          override?.mode === "start"
            ? `Clock in ${override?.staff.name}?`
            : `End ${override?.staff.name}'s shift?`
        }
        description="This is recorded in the shift log as done by the owner."
      >
        {override && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="ov-reason">Reason</Label>
              <Select id="ov-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="">Select a reason…</option>
                {OVERRIDE_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </div>
            {override.mode === "start" && override.staff.role === "barber" && (
              <div>
                <Label htmlFor="ov-chair">Chair</Label>
                <Select id="ov-chair" value={chairId} onChange={(e) => setChairId(e.target.value)}>
                  <option value="">No chair yet</option>
                  {chairs
                    .filter(
                      (c) =>
                        c.branchId === override.staff.branchId &&
                        (!c.staffId || c.staffId === override.staff.id),
                    )
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                </Select>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setOverride(null)}>
                Cancel
              </Button>
              <Button
                variant={override.mode === "end" ? "danger" : "default"}
                onClick={confirmOverride}
              >
                {override.mode === "start" ? (
                  <>
                    <UserCheck className="h-4 w-4" />
                    Clock in
                  </>
                ) : (
                  <>
                    <UserX className="h-4 w-4" />
                    End shift
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

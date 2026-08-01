"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Scissors, Armchair } from "lucide-react";
import { useAppStore } from "@/lib/store/app-store";
import { StatusBadge } from "@/components/ui/badge";

export default function QueueDisplayPage() {
  const queue = useAppStore((s) => s.queue);
  const staffStatuses = useAppStore((s) => s.staffStatuses);
  const chairs = useAppStore((s) => s.chairs);
  const staffList = useAppStore((s) => s.staff);
  const branches = useAppStore((s) => s.branches);
  const [clock, setClock] = useState("");

  useEffect(() => {
    const tick = () =>
      setClock(
        new Intl.DateTimeFormat("en-MY", {
          weekday: "long",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }).format(new Date()),
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const nowServing = useMemo(
    () => queue.filter((q) => q.status === "in-service"),
    [queue],
  );
  const waiting = useMemo(
    () => queue.filter((q) => q.status === "waiting" || q.status === "called"),
    [queue],
  );
  const branch = branches[0];
  const barbers = staffList.filter((s) => s.role === "barber");

  return (
    <div className="app-bg min-h-dvh p-6 md:p-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl gold-gradient">
              <Scissors className="h-7 w-7 text-[#0c0b09]" />
            </div>
            <div>
              <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gold)]">
                BarberFlow
              </p>
              <h1 className="font-display text-3xl font-bold md:text-4xl">
                {branch.name}
              </h1>
              <p className="text-[var(--text-muted)]">{branch.openHours}</p>
            </div>
          </div>
          <p className="font-display text-xl text-[var(--text-muted)] tabular-nums md:text-2xl">
            {clock}
          </p>
        </header>

        <section>
          <p className="mb-4 text-sm font-medium uppercase tracking-wider text-[var(--text-faint)]">
            Now Serving
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {nowServing.length === 0 && (
                <div className="card-surface col-span-full p-10 text-center text-[var(--text-muted)]">
                  No customers in service
                </div>
              )}
              {nowServing.map((ticket) => {
                    const chair = chairs.find((c) => c.id === ticket.chairId);
                const staff = staffList.find((s) => s.id === ticket.assignedStaffId);
                return (
                  <motion.div
                    key={ticket.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="card-surface pulse-gold border-[var(--gold)]/40 p-6"
                  >
                    <p className="font-display text-5xl font-bold text-[var(--gold-soft)] md:text-6xl">
                      {ticket.number}
                    </p>
                    <p className="mt-3 text-lg font-medium">{ticket.customerName}</p>
                    <p className="text-sm text-[var(--text-muted)]">
                      {ticket.serviceNames.join(" · ")}
                    </p>
                    <div className="mt-4 flex items-center gap-2 text-sm text-[var(--text-muted)]">
                      <Armchair className="h-4 w-4 text-[var(--gold)]" />
                      {chair?.label ?? "Chair"} · {staff?.name ?? "Barber"}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="lg:col-span-2">
            <p className="mb-4 text-sm font-medium uppercase tracking-wider text-[var(--text-faint)]">
              Waiting Queue
            </p>
            <div className="card-surface divide-y divide-[var(--border)] overflow-hidden p-0">
              {waiting.length === 0 && (
                <p className="p-8 text-center text-[var(--text-muted)]">
                  Queue is clear
                </p>
              )}
              {waiting.map((ticket, i) => (
                <div
                  key={ticket.id}
                  className="flex items-center justify-between gap-4 px-5 py-4"
                >
                  <div className="flex items-center gap-4">
                    <span className="font-display text-2xl font-bold text-[var(--gold-soft)]">
                      {ticket.number}
                    </span>
                    <div>
                      <p className="font-medium">{ticket.customerName}</p>
                      <p className="text-sm text-[var(--text-muted)]">
                        {ticket.serviceNames.join(" · ")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={ticket.status} />
                    <p className="mt-1 text-xs text-[var(--text-faint)]">
                      #{i + 1} · ~{ticket.estimatedWaitMins}m
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <p className="mb-4 text-sm font-medium uppercase tracking-wider text-[var(--text-faint)]">
              Chairs
            </p>
            <div className="space-y-3">
              {barbers.map((b) => {
                const chair = chairs.find((c) => c.id === b.chairId);
                const status = staffStatuses[b.id] ?? b.status;
                return (
                  <div key={b.id} className="card-surface flex items-center gap-3 p-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--gold)]/15 font-display font-bold text-[var(--gold-soft)]">
                      {chair?.number ?? "—"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{b.name}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {chair?.label ?? "Unassigned"}
                      </p>
                    </div>
                    <StatusBadge status={status} />
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

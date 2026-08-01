"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Armchair, Filter, Plus, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/app-shell";
import { PageTransition } from "@/components/layout/page-transition";
import { QueueCard } from "@/components/domain/queue-card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store/app-store";
import type { QueueStatus, QueueTicket } from "@/lib/types";
import { initials } from "@/lib/utils";

const STATUS_FILTERS: { value: QueueStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "waiting", label: "Waiting" },
  { value: "in-service", label: "In Service" },
  { value: "awaiting-payment", label: "Awaiting Pay" },
  { value: "completed", label: "Completed" },
];

function nextQueueNumber(queue: QueueTicket[]) {
  const nums = queue
    .map((q) => parseInt(q.number.replace(/\D/g, ""), 10))
    .filter((n) => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 15;
  return `A${String(max + 1).padStart(3, "0")}`;
}

export default function OwnerQueuePage() {
  const queue = useAppStore((s) => s.queue);
  const branchId = useAppStore((s) => s.branchId);
  const chairs = useAppStore((s) => s.chairs);
  const staff = useAppStore((s) => s.staff);
  const services = useAppStore((s) => s.services);
  const staffStatuses = useAppStore((s) => s.staffStatuses);
  const assignChair = useAppStore((s) => s.assignChair);
  const addQueueTicket = useAppStore((s) => s.addQueueTicket);

  const [filter, setFilter] = useState<QueueStatus | "all">("all");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [barberPref, setBarberPref] = useState("any");

  const barbers = staff.filter((s) => s.role === "barber");

  const filtered = useMemo(
    () =>
      filter === "all" ? queue : queue.filter((q) => q.status === filter),
    [queue, filter],
  );

  function handleReassign(chairId: string, staffId: string) {
    assignChair(chairId, staffId || null);
    const member = staff.find((s) => s.id === staffId);
    const chair = chairs.find((c) => c.id === chairId);
    toast.success("Chair reassigned", {
      description: `${chair?.label} → ${member?.name ?? "Unassigned"}`,
    });
  }

  function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      toast.error("Name and phone are required");
      return;
    }
    const service = services.find((s) => s.id === serviceId);
    if (!service) return;

    const ticket: QueueTicket = {
      id: `q-${Date.now()}`,
      number: nextQueueNumber(queue),
      branchId,
      customerId: `walk-${Date.now()}`,
      customerName: name.trim(),
      customerPhone: phone.trim(),
      serviceIds: [service.id],
      serviceNames: [service.name],
      preferredStaffId: barberPref === "any" ? null : barberPref,
      assignedStaffId: null,
      chairId: null,
      status: "waiting",
      estimatedWaitMins: 15 + Math.floor(Math.random() * 20),
      createdAt: new Date().toISOString(),
      source: "cashier",
    };

    addQueueTicket(ticket);
    toast.success("Walk-in registered", {
      description: `Ticket ${ticket.number} · ${ticket.customerName}`,
    });
    setRegisterOpen(false);
    setName("");
    setPhone("");
    setBarberPref("any");
  }

  return (
    <>
      <Topbar
        title="Queue Monitor"
        actions={
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-[var(--text-faint)] sm:inline">
              {queue.filter((q) => q.status === "waiting").length} waiting
            </span>
            <Button size="sm" onClick={() => setRegisterOpen(true)}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Walk-in</span>
            </Button>
          </div>
        }
      />
      <PageTransition>
        <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Armchair className="h-5 w-5 text-[var(--gold)]" />
              <h2 className="font-display text-lg font-semibold">Chair Management</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {chairs.map((chair, i) => {
                const assigned = staff.find((s) => s.id === chair.staffId);
                const status = assigned
                  ? staffStatuses[assigned.id]
                  : undefined;
                const activeTicket = queue.find(
                  (q) =>
                    q.chairId === chair.id && q.status === "in-service",
                );
                return (
                  <motion.div
                    key={chair.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card className="p-4">
                      <div className="mb-3 flex items-start justify-between">
                        <div>
                          <p className="font-display font-semibold">{chair.label}</p>
                          <p className="text-xs text-[var(--text-faint)]">
                            Station #{chair.number}
                          </p>
                        </div>
                        {status && <StatusBadge status={status} />}
                      </div>
                      {assigned ? (
                        <div className="mb-3 flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--gold)]/15 font-display text-xs font-semibold text-[var(--gold-soft)]">
                            {initials(assigned.name)}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{assigned.name}</p>
                            <p className="text-xs text-[var(--text-muted)]">
                              {assigned.specialty}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="mb-3 text-sm text-[var(--text-muted)]">
                          No barber assigned
                        </p>
                      )}
                      {activeTicket && (
                        <p className="mb-3 flex items-center gap-1.5 rounded-lg bg-[var(--gold)]/10 px-2.5 py-1.5 text-xs text-[var(--gold-soft)]">
                          <UserCheck className="h-3.5 w-3.5" />
                          Serving {activeTicket.customerName} · {activeTicket.number}
                        </p>
                      )}
                      <Select
                        value={chair.staffId ?? ""}
                        onChange={(e) => handleReassign(chair.id, e.target.value)}
                      >
                        <option value="">Unassigned</option>
                        {barbers.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} · {staffStatuses[b.id]}
                          </option>
                        ))}
                      </Select>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Filter className="h-4 w-4 text-[var(--text-faint)]" />
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                    filter === f.value
                      ? "bg-[var(--gold)]/15 text-[var(--gold-soft)] ring-1 ring-[var(--gold)]/30"
                      : "bg-[var(--bg-muted)] text-[var(--text-muted)] hover:text-[var(--text)]"
                  }`}
                >
                  {f.label}
                  {f.value !== "all" && (
                    <span className="ml-1 opacity-60">
                      ({queue.filter((q) => q.status === f.value).length})
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <AnimatePresence mode="popLayout">
                {filtered.map((ticket, i) => (
                  <motion.div
                    key={ticket.id}
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <QueueCard ticket={ticket} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {filtered.length === 0 && (
              <Card className="py-12 text-center">
                <p className="text-[var(--text-muted)]">No tickets in this filter.</p>
                <Button className="mt-4" onClick={() => setRegisterOpen(true)}>
                  Register Walk-in
                </Button>
              </Card>
            )}
          </div>
        </div>
      </PageTransition>

      <Modal
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        title="Register Walk-in"
        description="Add a new customer to the live queue."
      >
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <Label>Customer Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              required
            />
          </div>
          <div>
            <Label>Phone</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+60 12-345 6789"
              required
            />
          </div>
          <div>
            <Label>Service</Label>
            <Select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · RM{s.price}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Barber Preference</Label>
            <Select
              value={barberPref}
              onChange={(e) => setBarberPref(e.target.value)}
            >
              <option value="any">Any Available Barber</option>
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} · {b.specialty}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" className="w-full" size="lg">
            Add to Queue
          </Button>
        </form>
      </Modal>
    </>
  );
}

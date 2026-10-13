"use client";

import { useConfirm } from "@/hooks/use-confirm";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Armchair,
  Clock,
  Filter,
  Phone,
  Play,
  Plus,
  ShoppingCart,
  User,
  UserCheck,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/app-shell";
import { PageTransition } from "@/components/layout/page-transition";
import { QueueCard } from "@/components/domain/queue-card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { PillTabs } from "@/components/ui/pill-tabs";
import { registerWalkIn } from "@/lib/queue/actions";
import { useAppStore } from "@/lib/store/app-store";
import { findCustomerByPhone } from "@/lib/mock/data";
import { assignStaffChair } from "@/lib/staff/actions";
import type { QueueStatus, QueueTicket } from "@/lib/types";
import { formatTime, initials } from "@/lib/utils";

const STATUS_FILTERS: { value: QueueStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "waiting", label: "Waiting" },
  { value: "in-service", label: "In Service" },
  { value: "awaiting-payment", label: "Awaiting Pay" },
  { value: "completed", label: "Completed" },
];

function OwnerQueueContent() {
  const confirm = useConfirm();
  const router = useRouter();
  const params = useSearchParams();
  const queue = useAppStore((s) => s.queue);
  const branchId = useAppStore((s) => s.branchId);
  const chairs = useAppStore((s) => s.chairs);
  const staff = useAppStore((s) => s.staff);
  const services = useAppStore((s) => s.services);
  const customers = useAppStore((s) => s.customers);
  const staffStatuses = useAppStore((s) => s.staffStatuses);
  const assignChair = useAppStore((s) => s.assignChair);
  const addQueueTicket = useAppStore((s) => s.addQueueTicket);
  const updateQueueTicket = useAppStore((s) => s.updateQueueTicket);
  const loadPosTicket = useAppStore((s) => s.loadPosTicket);
  const clearPos = useAppStore((s) => s.clearPos);

  const [filter, setFilter] = useState<QueueStatus | "all">("all");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [detailTicket, setDetailTicket] = useState<QueueTicket | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [barberPref, setBarberPref] = useState("any");
  const [prefilledCustomerId, setPrefilledCustomerId] = useState<
    string | null
  >(null);

  // Coming from a customer's own CRM record ("Start a Visit") — open the
  // walk-in form pre-filled instead of making the owner retype their details.
  useEffect(() => {
    const prefillName = params.get("name");
    const prefillPhone = params.get("phone");
    if (!prefillName && !prefillPhone) return;
    setName(prefillName ?? "");
    setPhone(prefillPhone ?? "");
    setPrefilledCustomerId(params.get("customerId"));
    setRegisterOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const barbers = staff.filter(
    (s) => s.role === "barber" && s.branchId === branchId && s.active,
  );
  const branchChairs = chairs.filter((c) => c.branchId === branchId);
  const branchQueue = queue.filter((q) => q.branchId === branchId);
  const waitingCount = branchQueue.filter((q) => q.status === "waiting").length;

  const filtered = useMemo(
    () =>
      filter === "all"
        ? branchQueue
        : branchQueue.filter((q) => q.status === filter),
    [branchQueue, filter],
  );

  async function handleReassign(chairId: string, staffId: string) {
    const chair = chairs.find((c) => c.id === chairId);
    // Seat the barber picked, or — for "Unassigned" — unseat whoever was there.
    const target = staffId || chair?.staffId;
    if (!target) return;
    const result = await assignStaffChair(target, staffId ? chairId : null).catch(() => null);
    if (!result?.ok) {
      toast.error("Could not update the chair", {
        description: result?.error ?? "Check your connection and try again",
      });
      return;
    }
    assignChair(chairId, staffId || null);
    const member = staff.find((s) => s.id === staffId);
    toast.success("Chair reassigned", {
      description: `${chair?.label} → ${member?.name ?? "Unassigned"}`,
    });
  }

  function handleCall(ticket: QueueTicket) {
    updateQueueTicket(ticket.id, { status: "called" });
    toast.info(`Calling ${ticket.number}`, {
      description: `${ticket.customerName} — please proceed to counter`,
    });
    setDetailTicket({ ...ticket, status: "called" });
  }

  function handleStartAssign(ticket: QueueTicket) {
    const free = barbers.filter((b) => staffStatuses[b.id] === "available");
    const preferred = ticket.preferredStaffId
      ? barbers.find((b) => b.id === ticket.preferredStaffId)
      : undefined;
    if (
      preferred &&
      !free.includes(preferred) &&
      staffStatuses[preferred.id] === "busy"
    ) {
      toast.info(`${preferred.name} is with another customer`, {
        description: "Assign when they're free, or wait for them",
      });
      return;
    }
    const assignee = free.find((b) => b.id === ticket.preferredStaffId) ?? free[0];
    if (!assignee) {
      toast.error("No barber is free", {
        description: "Nobody on shift is available right now",
      });
      return;
    }

    updateQueueTicket(ticket.id, {
      status: "in-service",
      assignedStaffId: assignee.id,
      chairId: assignee.chairId,
      startedAt: new Date().toISOString(),
      estimatedWaitMins: 0,
    });
    toast.success("Service started", {
      description: `${ticket.customerName} assigned to ${assignee.name}`,
    });
    setDetailTicket(null);
  }

  function handleNoShow(ticket: QueueTicket) {
    confirm.ask({
      title: `Mark ${ticket.customerName} as no-show?`,
      description: "They lose their place in the queue.",
      confirmLabel: "No-show",
      run: () => {
        updateQueueTicket(ticket.id, { status: "no-show" });
        toast.error("Marked as no-show", { description: ticket.customerName });
        setDetailTicket(null);
      },
    });
  }

  /**
   * A ticket can get stuck in-service forever if the barber's tab crashes or
   * the customer just walks out — there's no auto-timeout, so this is the
   * only way off. Frees the barber and chair; nothing is billed.
   */
  function handleCancel(ticket: QueueTicket) {
    confirm.ask({
      title: `Cancel ${ticket.customerName}'s ticket?`,
      description:
        "Use this if the service can't be finished — the barber and chair are freed, and nothing is billed.",
      confirmLabel: "Cancel ticket",
      run: () => {
        updateQueueTicket(ticket.id, { status: "cancelled" });
        toast.error("Ticket cancelled", { description: ticket.customerName });
        setDetailTicket(null);
      },
    });
  }

  function handleSendToPos(ticket: QueueTicket) {
    clearPos();
    updateQueueTicket(ticket.id, { status: "awaiting-payment" });
    loadPosTicket(ticket.id);
    toast.success("Sent to POS", { description: ticket.customerName });
    setDetailTicket(null);
    router.push("/owner/pos");
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      toast.error("Name and phone are required");
      return;
    }
    const service = services.find((s) => s.id === serviceId);
    if (!service) return;

    // Prefer the customer we already know (came from their CRM record);
    // otherwise a walk-in typed in here can still match an existing
    // customer by phone, so they aren't recreated as a stranger.
    const matched = prefilledCustomerId
      ? customers.find((c) => c.id === prefilledCustomerId)
      : findCustomerByPhone(customers, phone);

    if (registering) return;

    // The server issues the ticket — its number comes from a per-branch
    // counter, so two counters registering at once cannot collide.
    setRegistering(true);
    const result = await registerWalkIn({
      branchId,
      customerId: matched?.id,
      name,
      phone,
      email,
      serviceIds: [service.id],
      preferredStaffId: barberPref === "any" ? null : barberPref,
      estimatedWaitMins: 15 + Math.floor(Math.random() * 20),
      source: "cashier",
    }).catch(() => null);
    setRegistering(false);
    if (!result?.ok) {
      toast.error("Couldn't register the walk-in", {
        description: result?.error ?? "Check your connection and try again",
      });
      return;
    }
    const { ticket } = result.data;

    addQueueTicket(ticket);
    toast.success("Walk-in registered", {
      description: matched
        ? `Ticket ${ticket.number} · ${ticket.customerName} · recognised as a returning customer`
        : `Ticket ${ticket.number} · ${ticket.customerName}`,
    });
    setRegisterOpen(false);
    setName("");
    setPhone("");
    setEmail("");
    setBarberPref("any");
    setPrefilledCustomerId(null);
  }

  return (
    <>
      {confirm.node}
      <Topbar
        title="Queue Monitor"
        actions={
          <Button
            size="sm"
            className="rounded-full bg-[var(--text)] text-[var(--bg)] hover:bg-[var(--text)]/90"
            onClick={() => setRegisterOpen(true)}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Walk-in</span>
          </Button>
        }
      />
      <PageTransition>
        <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
          <p className="text-sm text-[var(--text-muted)]">
            {branchChairs.length} chair{branchChairs.length === 1 ? "" : "s"} ·{" "}
            {waitingCount} waiting
          </p>

          <div>
            <div className="mb-4 flex items-center gap-2">
              <Armchair className="h-5 w-5 text-[var(--gold)]" />
              <h2 className="font-display text-lg font-semibold">Chair Management</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {branchChairs.map((chair, i) => {
                const assigned = staff.find((s) => s.id === chair.staffId);
                const status = assigned
                  ? staffStatuses[assigned.id]
                  : undefined;
                const activeTicket = branchQueue.find(
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
              <Filter className="hidden h-4 w-4 shrink-0 text-[var(--text-faint)] sm:block" />
              <PillTabs
                tabs={STATUS_FILTERS.map((f) => ({
                  value: f.value,
                  label: f.label,
                  count: f.value === "all" ? undefined : branchQueue.filter((q) => q.status === f.value).length,
                }))}
                value={filter}
                onChange={(v) => setFilter(v as QueueStatus | "all")}
              />
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
                    <QueueCard
                      ticket={ticket}
                      active={detailTicket?.id === ticket.id}
                      onClick={() => setDetailTicket(ticket)}
                    />
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
            <Label>Email (for the receipt)</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Ask the customer — optional"
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
              {barbers
                .filter((b) => b.status !== "off-duty")
                .map((b) => (
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

      <Modal
        open={!!detailTicket}
        onOpenChange={(open) => !open && setDetailTicket(null)}
        title={detailTicket ? `Ticket ${detailTicket.number}` : ""}
        description={detailTicket?.customerName}
      >
        {detailTicket && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={detailTicket.status} />
              <span className="rounded-lg bg-[var(--bg-muted)] px-2 py-1 text-xs text-[var(--text-muted)]">
                {detailTicket.source}
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-2 text-[var(--text-muted)]">
                <User className="h-4 w-4" />
                {detailTicket.customerPhone}
              </p>
              <p>{detailTicket.serviceNames.join(" · ")}</p>
              <p className="flex items-center gap-2 text-[var(--text-faint)]">
                <Clock className="h-4 w-4" />
                Joined {formatTime(detailTicket.createdAt)}
                {detailTicket.estimatedWaitMins > 0 &&
                  ` · ~${detailTicket.estimatedWaitMins} min wait`}
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              {(detailTicket.status === "waiting" ||
                detailTicket.status === "called") && (
                <Button variant="secondary" onClick={() => handleCall(detailTicket)}>
                  <Phone className="h-4 w-4" />
                  Call
                </Button>
              )}
              {(detailTicket.status === "waiting" ||
                detailTicket.status === "called") && (
                <Button onClick={() => handleStartAssign(detailTicket)}>
                  <Play className="h-4 w-4" />
                  Start & Assign
                </Button>
              )}
              {(detailTicket.status === "in-service" ||
                detailTicket.status === "awaiting-payment" ||
                detailTicket.status === "called") && (
                <Button
                  variant="outline"
                  onClick={() => handleSendToPos(detailTicket)}
                >
                  <ShoppingCart className="h-4 w-4" />
                  Send to POS
                </Button>
              )}
              {detailTicket.status === "called" && (
                <Button
                  variant="outline"
                  onClick={() => handleNoShow(detailTicket)}
                  className="border-[var(--danger)]/30 text-[var(--danger)] hover:bg-[var(--danger)]/10"
                >
                  <UserX className="h-4 w-4" />
                  No-Show
                </Button>
              )}
              {detailTicket.status === "in-service" && (
                <Button
                  variant="outline"
                  onClick={() => handleCancel(detailTicket)}
                  className="border-[var(--danger)]/30 text-[var(--danger)] hover:bg-[var(--danger)]/10"
                >
                  <UserX className="h-4 w-4" />
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

export default function OwnerQueuePage() {
  return (
    <Suspense fallback={<div className="p-6 text-[var(--text-muted)]">Loading…</div>}>
      <OwnerQueueContent />
    </Suspense>
  );
}

"use client";

import { useConfirm } from "@/hooks/use-confirm";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Phone,
  Play,
  ShoppingCart,
  Filter,
  User,
  Clock,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/app-shell";
import { PageTransition } from "@/components/layout/page-transition";
import { QueueCard } from "@/components/domain/queue-card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { useAppStore } from "@/lib/store/app-store";
import type { QueueStatus, QueueTicket } from "@/lib/types";
import { formatTime } from "@/lib/utils";

const STATUS_FILTERS: { value: QueueStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "waiting", label: "Waiting" },
  { value: "called", label: "Called" },
  { value: "in-service", label: "In Service" },
  { value: "awaiting-payment", label: "Awaiting Pay" },
  { value: "completed", label: "Completed" },
  { value: "no-show", label: "No Show" },
];

function nextQueueNumber(queue: QueueTicket[]) {
  const nums = queue
    .map((q) => parseInt(q.number.replace(/\D/g, ""), 10))
    .filter((n) => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 15;
  return `A${String(max + 1).padStart(3, "0")}`;
}

function QueuePageContent() {
  const confirm = useConfirm();
  const maxWaitMins = useAppStore((s) => s.opsRules.maxWaitMins);
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const allQueue = useAppStore((s) => s.queue);
  const activeBranchId = useAppStore((s) => s.branchId);
  const queue = useMemo(
    () => allQueue.filter((q) => q.branchId === activeBranchId),
    [allQueue, activeBranchId],
  );
  const branchId = useAppStore((s) => s.branchId);
  const services = useAppStore((s) => s.services);
  const staff = useAppStore((s) => s.staff);
  const addQueueTicket = useAppStore((s) => s.addQueueTicket);
  const updateQueueTicket = useAppStore((s) => s.updateQueueTicket);
  const staffStatuses = useAppStore((s) => s.staffStatuses);
  const loadPosTicket = useAppStore((s) => s.loadPosTicket);
  const clearPos = useAppStore((s) => s.clearPos);

  const [filter, setFilter] = useState<QueueStatus | "all">("all");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [detailTicket, setDetailTicket] = useState<QueueTicket | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [barberPref, setBarberPref] = useState("any");

  useEffect(() => {
    if (searchParams.get("register") === "1") setRegisterOpen(true);
  }, [searchParams]);

  const filtered = useMemo(
    () =>
      filter === "all" ? queue : queue.filter((q) => q.status === filter),
    [queue, filter],
  );

  const barbers = staff.filter(
    (s) => s.role === "barber" && s.branchId === branchId && s.active,
  );

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
      customerEmail: email.trim() || undefined,
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
    setEmail("");
    setBarberPref("any");
  }

  function handleCall(ticket: QueueTicket) {
    updateQueueTicket(ticket.id, { status: "called" });
    toast.info(`Calling ${ticket.number}`, {
      description: `${ticket.customerName} — please proceed to counter`,
    });
    setDetailTicket({ ...ticket, status: "called" });
  }

  function handleStartAssign(ticket: QueueTicket) {
    // Only a barber who is on shift and free can take the customer — never
    // someone off duty or on break.
    const free = barbers.filter((b) => staffStatuses[b.id] === "available");
    const preferred = ticket.preferredStaffId
      ? barbers.find((b) => b.id === ticket.preferredStaffId)
      : undefined;
    // A regular waits for their own barber while that barber is on the floor
    // (just busy). Only if they've gone off or are on break do we hand them on.
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
    const staff = free.find((b) => b.id === ticket.preferredStaffId) ?? free[0];
    if (!staff) {
      toast.error("No barber is free", {
        description: "Nobody on shift is available right now",
      });
      return;
    }

    updateQueueTicket(ticket.id, {
      status: "in-service",
      assignedStaffId: staff.id,
      chairId: staff.chairId,
      startedAt: new Date().toISOString(),
      estimatedWaitMins: 0,
    });
    toast.success("Service started", {
      description: `${ticket.customerName} assigned to ${staff.name}`,
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

  function handleSendToPos(ticket: QueueTicket) {
    clearPos();
    updateQueueTicket(ticket.id, { status: "awaiting-payment" });
    // Links the sale to this ticket so its customer, email, barber and
    // member pricing carry through to checkout.
    loadPosTicket(ticket.id);
    toast.success("Sent to POS", { description: ticket.customerName });
    setDetailTicket(null);
    router.push("/cashier/pos");
  }

  const overLimit = queue.filter(
    (q) =>
      q.status === "waiting" &&
      (nowMs - new Date(q.createdAt).getTime()) / 60000 > maxWaitMins,
  ).length;

  return (
    <>
      {confirm.node}
      <Topbar
        title="Queue Monitor"
        actions={
          <Button size="sm" onClick={() => setRegisterOpen(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Walk-in</span>
          </Button>
        }
      />
      <PageTransition>
        <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
          {overLimit > 0 && (
            <p className="rounded-xl border border-[var(--warning)]/30 bg-[var(--warning)]/10 px-4 py-2.5 text-sm text-[var(--text-muted)]">
              {overLimit} {overLimit === 1 ? "customer has" : "customers have"} waited
              longer than {maxWaitMins} min.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
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
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

export default function CashierQueuePage() {
  return (
    <Suspense fallback={<div className="p-6 text-[var(--text-muted)]">Loading…</div>}>
      <QueuePageContent />
    </Suspense>
  );
}

"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, HeadphonesIcon, Plus, Search } from "lucide-react";
import { Topbar } from "@/components/layout/app-shell";
import { PageTransition } from "@/components/layout/page-transition";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { usePlatformStore } from "@/lib/store/platform-store";
import type { SupportTicket } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

type StatusFilter = "all" | SupportTicket["status"];

const emptyTicketForm = {
  tenantId: "",
  subject: "",
  priority: "medium" as SupportTicket["priority"],
};

export default function SuperAdminSupportPage() {
  const supportTickets = usePlatformStore((s) => s.supportTickets);
  const tenants = usePlatformStore((s) => s.tenants);
  const openTicketCount = usePlatformStore((s) => s.openTicketCount);
  const addSupportTicket = usePlatformStore((s) => s.addSupportTicket);
  const updateTicket = usePlatformStore((s) => s.updateTicket);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [ticketForm, setTicketForm] = useState(emptyTicketForm);

  const filtered = useMemo(() => {
    return supportTickets.filter((t) => {
      const q = search.toLowerCase();
      const matchesSearch =
        t.subject.toLowerCase().includes(q) ||
        t.tenantName.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === "all" || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [supportTickets, search, statusFilter]);

  function handleCreateTicket() {
    if (!ticketForm.tenantId || !ticketForm.subject.trim()) {
      toast.error("Tenant and subject are required");
      return;
    }
    const ticket = addSupportTicket(ticketForm);
    toast.success("Ticket created", { description: ticket.subject });
    setAddOpen(false);
    setTicketForm(emptyTicketForm);
  }

  function startTicket(id: string) {
    updateTicket(id, { status: "in-progress" });
    toast.info("Ticket marked in progress");
  }

  function resolveTicket(id: string) {
    const ticket = supportTickets.find((t) => t.id === id);
    updateTicket(id, { status: "resolved" });
    toast.success("Ticket resolved", { description: ticket?.subject });
  }

  return (
    <>
      <Topbar
        title="Support"
        actions={
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 text-xs text-[var(--text-faint)]">
              <span className="flex h-2 w-2 rounded-full bg-[var(--success)]" />
              {openTicketCount()} open
            </span>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              New Ticket
            </Button>
          </div>
        }
      />
      <PageTransition>
        <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
          <Card>
            <CardHeader>
              <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <CardTitle className="flex items-center gap-2">
                  <HeadphonesIcon className="h-5 w-5 text-[var(--gold)]" />
                  Support Tickets
                </CardTitle>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-faint)]" />
                    <Input
                      placeholder="Search tickets..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9 sm:w-52"
                    />
                  </div>
                  <Select
                    value={statusFilter}
                    onChange={(e) =>
                      setStatusFilter(e.target.value as StatusFilter)
                    }
                    className="sm:w-36"
                  >
                    <option value="all">All status</option>
                    <option value="open">Open</option>
                    <option value="in-progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                  </Select>
                </div>
              </div>
            </CardHeader>

            <div className="space-y-3">
              {filtered.map((ticket, i) => (
                <motion.div
                  key={ticket.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/30 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-[var(--text-faint)]">
                        {ticket.id.toUpperCase()}
                      </span>
                      <StatusBadge status={ticket.priority} />
                      <StatusBadge status={ticket.status} />
                    </div>
                    <p className="mt-1.5 font-medium">{ticket.subject}</p>
                    <p className="text-sm text-[var(--text-muted)]">
                      {ticket.tenantName} · {formatDate(ticket.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {ticket.status === "open" && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => startTicket(ticket.id)}
                      >
                        Start
                      </Button>
                    )}
                    {ticket.status !== "resolved" && (
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => resolveTicket(ticket.id)}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Resolve
                      </Button>
                    )}
                    {ticket.status === "resolved" && (
                      <span className="flex items-center gap-1 text-xs text-[var(--success)]">
                        <CheckCircle2 className="h-4 w-4" />
                        Resolved
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}

              {filtered.length === 0 && (
                <div className="py-12 text-center text-[var(--text-muted)]">
                  No tickets match your filters.
                </div>
              )}
            </div>
          </Card>
        </div>
      </PageTransition>

      <Modal
        open={addOpen}
        onOpenChange={setAddOpen}
        title="New Support Ticket"
        description="Create a ticket on behalf of a tenant"
        className="max-w-md"
      >
        <div className="space-y-4">
          <div>
            <Label>Tenant</Label>
            <Select
              value={ticketForm.tenantId || tenants[0]?.id || ""}
              onChange={(e) =>
                setTicketForm({ ...ticketForm, tenantId: e.target.value })
              }
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Subject</Label>
            <Input
              value={ticketForm.subject}
              onChange={(e) =>
                setTicketForm({ ...ticketForm, subject: e.target.value })
              }
              placeholder="Billing question, onboarding help..."
            />
          </div>
          <div>
            <Label>Priority</Label>
            <Select
              value={ticketForm.priority}
              onChange={(e) =>
                setTicketForm({
                  ...ticketForm,
                  priority: e.target.value as SupportTicket["priority"],
                })
              }
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </Select>
          </div>
          <Button className="w-full" onClick={handleCreateTicket}>
            Create Ticket
          </Button>
        </div>
      </Modal>
    </>
  );
}

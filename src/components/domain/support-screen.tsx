"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { HeadphonesIcon, Plus } from "lucide-react";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/app-shell";
import { PageTransition } from "@/components/layout/page-transition";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { fetchMyTickets } from "@/lib/platform/client";
import { raiseSupportTicket } from "@/lib/platform/actions";
import type { SupportTicket } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

/** Left-edge accent colour per ticket status — mirrors the admin list. */
const BORDER_BY_STATUS: Record<string, string> = {
  open: "border-l-[var(--info)]",
  "in-progress": "border-l-[var(--warning)]",
  resolved: "border-l-[var(--success)]",
};

const emptyForm = {
  subject: "",
  priority: "medium" as SupportTicket["priority"],
};

/**
 * "Raise a ticket" for an owner, cashier or barber — status-only visibility,
 * no reply thread (that's a deliberate v1 scope cut). Shared across all
 * three portals since `requireShopSession()` already scopes everything to
 * the signed-in tenant; nothing here is role-specific.
 */
export function SupportScreen() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchMyTickets().then((result) => {
      if (cancelled) return;
      setTickets(result?.tickets ?? []);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreate() {
    if (!form.subject.trim()) {
      toast.error("Subject is required");
      return;
    }
    setSubmitting(true);
    const result = await raiseSupportTicket(form);
    setSubmitting(false);
    if (!result.ok) {
      toast.error("Could not raise ticket", { description: result.error });
      return;
    }
    const refreshed = await fetchMyTickets();
    setTickets(refreshed?.tickets ?? []);
    toast.success("Ticket raised", { description: form.subject });
    setAddOpen(false);
    setForm(emptyForm);
  }

  return (
    <>
      <Topbar
        title="Support"
        actions={
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            New Ticket
          </Button>
        }
      />
      <PageTransition>
        <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HeadphonesIcon className="h-5 w-5 text-[var(--gold)]" />
                Your Tickets
              </CardTitle>
            </CardHeader>

            <div className="space-y-3">
              {!loading && tickets.length === 0 && (
                <div className="py-12 text-center text-[var(--text-muted)]">
                  No tickets yet. Something not working? Raise one above.
                </div>
              )}

              {tickets.map((ticket, i) => (
                <motion.div
                  key={ticket.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={cn(
                    "flex flex-col gap-2 rounded-xl border border-l-4 border-[var(--border)] bg-[var(--bg-muted)]/30 p-4",
                    BORDER_BY_STATUS[ticket.status] ?? "border-l-[var(--border)]",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={ticket.priority} />
                    <StatusBadge status={ticket.status} />
                  </div>
                  <p className="font-medium">{ticket.subject}</p>
                  <p className="text-sm text-[var(--text-muted)]">
                    Raised {formatDate(ticket.createdAt)}
                  </p>
                </motion.div>
              ))}
            </div>
          </Card>
        </div>
      </PageTransition>

      <Modal
        open={addOpen}
        onOpenChange={setAddOpen}
        title="New Support Ticket"
        description="Tell us what's going wrong — we'll follow up"
        className="max-w-md"
      >
        <div className="space-y-4">
          <div>
            <Label>Subject</Label>
            <Input
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="Can't print receipts, billing question..."
            />
          </div>
          <div>
            <Label>Priority</Label>
            <Select
              value={form.priority}
              onChange={(e) =>
                setForm({ ...form, priority: e.target.value as SupportTicket["priority"] })
              }
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </Select>
          </div>
          <Button className="w-full" disabled={submitting} onClick={handleCreate}>
            Raise Ticket
          </Button>
        </div>
      </Modal>
    </>
  );
}

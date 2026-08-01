"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Phone,
  Mail,
  Calendar,
  Scissors,
  Download,
  UserPlus,
} from "lucide-react";
import { Topbar } from "@/components/layout/app-shell";
import { PageTransition } from "@/components/layout/page-transition";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CUSTOMERS, STAFF } from "@/lib/mock/data";
import type { Customer } from "@/lib/types";
import { formatCurrency, formatDate, initials } from "@/lib/utils";
import { toast } from "sonner";

export default function OwnerCustomerPage() {
  const [search, setSearch] = useState("");
  const [membershipFilter, setMembershipFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "visits" | "spent">("visits");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [view, setView] = useState<"table" | "cards">("table");

  const filtered = useMemo(() => {
    const list = CUSTOMERS.filter((c) => {
      const matchSearch =
        !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.phone.includes(search) ||
        c.email?.toLowerCase().includes(search.toLowerCase());
      const matchMembership =
        membershipFilter === "all" || c.membership === membershipFilter;
      return matchSearch && matchMembership;
    });
    return list.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "visits") return b.visits - a.visits;
      return b.totalSpent - a.totalSpent;
    });
  }, [search, membershipFilter, sortBy]);

  const stats = useMemo(() => ({
    total: CUSTOMERS.length,
    members: CUSTOMERS.filter((c) => c.membership !== "none").length,
    platinum: CUSTOMERS.filter((c) => c.membership === "platinum").length,
    avgSpend:
      CUSTOMERS.reduce((s, c) => s + c.totalSpent, 0) / CUSTOMERS.length,
  }), []);

  function handleExport() {
    toast.success("Export started", {
      description: `${filtered.length} customer records · CSV mock`,
    });
  }

  return (
    <>
      <Topbar
        title="Customer CRM"
        actions={
          <Button variant="ghost" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        }
      />
      <PageTransition>
        <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
          <div className="grid gap-3 sm:grid-cols-4">
            <Card className="p-4">
              <p className="text-xs text-[var(--text-faint)]">Total Customers</p>
              <p className="font-display text-2xl font-semibold">{stats.total}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-[var(--text-faint)]">Members</p>
              <p className="font-display text-2xl font-semibold text-[var(--gold-soft)]">
                {stats.members}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-[var(--text-faint)]">Platinum</p>
              <p className="font-display text-2xl font-semibold">{stats.platinum}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-[var(--text-faint)]">Avg Lifetime Value</p>
              <p className="font-display text-2xl font-semibold">
                {formatCurrency(stats.avgSpend)}
              </p>
            </Card>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-faint)]" />
              <Input
                className="pl-10"
                placeholder="Search name, phone, or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              value={membershipFilter}
              onChange={(e) => setMembershipFilter(e.target.value)}
              className="h-11 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] px-4 text-sm"
            >
              <option value="all">All Memberships</option>
              <option value="none">Walk-in</option>
              <option value="silver">Silver</option>
              <option value="gold">Gold</option>
              <option value="platinum">Platinum</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="h-11 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] px-4 text-sm"
            >
              <option value="visits">Sort by Visits</option>
              <option value="spent">Sort by Spend</option>
              <option value="name">Sort by Name</option>
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => setView("table")}
                className={`rounded-xl px-3 py-2 text-sm ${
                  view === "table"
                    ? "bg-[var(--gold)]/15 text-[var(--gold-soft)]"
                    : "bg-[var(--bg-muted)] text-[var(--text-muted)]"
                }`}
              >
                Table
              </button>
              <button
                onClick={() => setView("cards")}
                className={`rounded-xl px-3 py-2 text-sm ${
                  view === "cards"
                    ? "bg-[var(--gold)]/15 text-[var(--gold-soft)]"
                    : "bg-[var(--bg-muted)] text-[var(--text-muted)]"
                }`}
              >
                Cards
              </button>
            </div>
          </div>

          {view === "table" ? (
            <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
              <div className="hidden grid-cols-[1fr_auto_auto_auto_auto] gap-4 border-b border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-xs font-medium uppercase tracking-wider text-[var(--text-faint)] lg:grid">
                <span>Customer</span>
                <span className="w-24 text-center">Membership</span>
                <span className="w-16 text-center">Visits</span>
                <span className="w-28 text-right">Total Spend</span>
                <span className="w-28 text-right">Last Visit</span>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {filtered.map((customer, i) => (
                  <motion.button
                    key={customer.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.015, 0.4) }}
                    onClick={() => setSelected(customer)}
                    className="flex w-full items-center gap-4 px-4 py-3 text-left transition hover:bg-[var(--bg-muted)]"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--gold)]/15 font-display text-xs font-semibold text-[var(--gold-soft)]">
                        {initials(customer.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{customer.name}</p>
                        <p className="truncate text-xs text-[var(--text-faint)]">
                          {customer.phone}
                        </p>
                      </div>
                    </div>
                    <div className="hidden w-24 justify-center lg:flex">
                      <StatusBadge status={customer.membership} />
                    </div>
                    <span className="hidden w-16 text-center text-sm lg:block">
                      {customer.visits}
                    </span>
                    <span className="hidden w-28 text-right text-sm font-medium text-[var(--gold-soft)] lg:block">
                      {formatCurrency(customer.totalSpent)}
                    </span>
                    <span className="hidden w-28 text-right text-xs text-[var(--text-faint)] lg:block">
                      {formatDate(customer.lastVisit)}
                    </span>
                    <div className="flex flex-col items-end gap-1 lg:hidden">
                      <StatusBadge status={customer.membership} />
                      <span className="text-xs text-[var(--text-faint)]">
                        {customer.visits} visits · {formatCurrency(customer.totalSpent)}
                      </span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.slice(0, 24).map((customer, i) => (
                <motion.button
                  key={customer.id}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.02 }}
                  onClick={() => setSelected(customer)}
                  className="card-surface p-4 text-left transition hover:border-[var(--gold)]/30"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--gold)]/15 font-display text-sm font-bold text-[var(--gold-soft)]">
                      {initials(customer.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{customer.name}</p>
                      <StatusBadge status={customer.membership} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-[var(--bg-muted)] p-2">
                      <p className="text-[var(--text-faint)]">Visits</p>
                      <p className="font-semibold">{customer.visits}</p>
                    </div>
                    <div className="rounded-lg bg-[var(--bg-muted)] p-2">
                      <p className="text-[var(--text-faint)]">Spent</p>
                      <p className="font-semibold text-[var(--gold-soft)]">
                        {formatCurrency(customer.totalSpent)}
                      </p>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          )}

          {filtered.length === 0 && (
            <Card className="py-12 text-center text-[var(--text-muted)]">
              No customers found.
            </Card>
          )}

          <p className="text-center text-xs text-[var(--text-faint)]">
            Showing {filtered.length} of {CUSTOMERS.length} customers
          </p>
        </div>
      </PageTransition>

      <Modal
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
        title={selected?.name}
      >
        {selected && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--gold)]/15 font-display text-lg font-bold text-[var(--gold-soft)]">
                {initials(selected.name)}
              </div>
              <div>
                <StatusBadge status={selected.membership} />
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Last visit {formatDate(selected.lastVisit)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[var(--bg-muted)] p-3">
                <p className="text-xs text-[var(--text-faint)]">Visits</p>
                <p className="font-display text-xl font-semibold">{selected.visits}</p>
              </div>
              <div className="rounded-xl bg-[var(--bg-muted)] p-3">
                <p className="text-xs text-[var(--text-faint)]">Total Spend</p>
                <p className="font-display text-xl font-semibold text-[var(--gold-soft)]">
                  {formatCurrency(selected.totalSpent)}
                </p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-2 text-[var(--text-muted)]">
                <Phone className="h-4 w-4" />
                {selected.phone}
              </p>
              {selected.email && (
                <p className="flex items-center gap-2 text-[var(--text-muted)]">
                  <Mail className="h-4 w-4" />
                  {selected.email}
                </p>
              )}
              <p className="flex items-center gap-2 text-[var(--text-muted)]">
                <Calendar className="h-4 w-4" />
                Last visit {formatDate(selected.lastVisit)}
              </p>
              {selected.preferredStaffId && (
                <p className="flex items-center gap-2 text-[var(--text-muted)]">
                  <Scissors className="h-4 w-4" />
                  Preferred:{" "}
                  {STAFF.find((s) => s.id === selected.preferredStaffId)?.name ?? "—"}
                </p>
              )}
            </div>

            <Button
              variant="secondary"
              className="w-full"
              onClick={() =>
                toast.info("Booking flow", {
                  description: `Schedule appointment for ${selected.name}`,
                })
              }
            >
              <UserPlus className="h-4 w-4" />
              Book Appointment
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}

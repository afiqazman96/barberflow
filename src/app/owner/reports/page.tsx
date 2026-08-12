"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  Users,
  Repeat,
  Award,
  Scissors,
  FileSpreadsheet,
  FileText,
  ShoppingCart,
  Package,
  Percent,
  ListOrdered,
  CalendarDays,
  UserCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/app-shell";
import { PageTransition } from "@/components/layout/page-transition";
import { SalesChart, PeakHoursChart } from "@/components/domain/charts";
import { StatCard } from "@/components/domain/stat-card";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store/app-store";
import {
  SALES_TREND,
  PEAK_HOURS,
  TOP_SERVICES,
  CUSTOMERS,
} from "@/lib/mock/data";
import { formatCurrency, initials } from "@/lib/utils";
import {
  buildBookingReport,
  buildCommissionReport,
  buildCustomerReport,
  buildProductReport,
  buildQueueReport,
  buildSalesReport,
  buildServiceReport,
  buildStaffReport,
} from "@/lib/reports/builders";
import { downloadExcel, downloadPdf, type BuiltReport } from "@/lib/reports/export";

const TABS = [
  { id: "overview", label: "Overview", icon: TrendingUp },
  { id: "sales", label: "POS Sales", icon: ShoppingCart },
  { id: "staff", label: "Staff", icon: Users },
  { id: "customers", label: "Customers", icon: UserCircle },
  { id: "services", label: "Services", icon: Scissors },
  { id: "products", label: "Products", icon: Package },
  { id: "commission", label: "Commission", icon: Percent },
  { id: "queue", label: "Queue", icon: ListOrdered },
  { id: "bookings", label: "Appointments", icon: CalendarDays },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function OwnerReportsPage() {
  const [tab, setTab] = useState<TabId>("overview");
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);

  const sales = useAppStore((s) => s.sales);
  const staff = useAppStore((s) => s.staff);
  const services = useAppStore((s) => s.services);
  const products = useAppStore((s) => s.products);
  const queue = useAppStore((s) => s.queue);
  const bookings = useAppStore((s) => s.bookings);
  const branches = useAppStore((s) => s.branches);
  const branchId = useAppStore((s) => s.branchId);
  const business = useAppStore((s) => s.businessProfile);

  const branchName = branches.find((b) => b.id === branchId)?.name;

  const reports = useMemo(() => {
    const map: Record<Exclude<TabId, "overview">, BuiltReport> = {
      sales: buildSalesReport(sales, branchName),
      staff: buildStaffReport(staff, sales),
      customers: buildCustomerReport(CUSTOMERS),
      services: buildServiceReport(services, sales),
      products: buildProductReport(products, sales),
      commission: buildCommissionReport(sales),
      queue: buildQueueReport(queue),
      bookings: buildBookingReport(bookings),
    };
    return map;
  }, [sales, staff, services, products, queue, bookings, branchName]);

  const activeReport = tab === "overview" ? null : reports[tab];

  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
  const avgTicket = totalRevenue / Math.max(sales.length, 1);

  const topStaff = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    sales.forEach((s) => {
      const cur = map.get(s.staffId) ?? { total: 0, count: 0 };
      map.set(s.staffId, { total: cur.total + s.total, count: cur.count + 1 });
    });
    return staff
      .filter((s) => s.role === "barber")
      .map((member) => ({
        staff: member,
        ...(map.get(member.id) ?? { total: 0, count: 0 }),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [sales, staff]);

  const returningRate = useMemo(() => {
    const repeat = CUSTOMERS.filter((c) => c.visits >= 3).length;
    return Math.round((repeat / CUSTOMERS.length) * 100);
  }, []);

  const retentionStats = {
    returning: returningRate,
    newThisMonth: CUSTOMERS.filter((c) => c.visits <= 2).length,
    avgVisits: (
      CUSTOMERS.reduce((s, c) => s + c.visits, 0) / CUSTOMERS.length
    ).toFixed(1),
  };

  const maxServiceCount = TOP_SERVICES[0]?.count ?? 1;

  async function handleExport(format: "excel" | "pdf") {
    if (!activeReport) return;
    setExporting(format);
    try {
      if (format === "excel") {
        downloadExcel(activeReport);
      } else {
        downloadPdf(activeReport, {
          businessName: business.name,
          generatedAt: new Date().toLocaleString("en-MY"),
        });
      }
      toast.success(
        format === "excel" ? "Excel downloaded" : "PDF downloaded",
        { description: activeReport.title },
      );
    } catch (err) {
      toast.error("Export failed", {
        description: err instanceof Error ? err.message : "Try again",
      });
    } finally {
      setExporting(null);
    }
  }

  return (
    <>
      <Topbar title="Reports & Analytics" />
      <PageTransition>
        <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {TABS.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-[var(--gold)]/15 text-[var(--gold-soft)] ring-1 ring-[var(--gold)]/30"
                      : "bg-[var(--bg-elevated)] text-[var(--text-muted)] ring-1 ring-[var(--border)] hover:text-[var(--text)]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>

          {tab === "overview" && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Total Revenue"
                  value={formatCurrency(totalRevenue)}
                  change={`${sales.length} transactions`}
                  trend="up"
                  icon={TrendingUp}
                  delay={0}
                />
                <StatCard
                  label="Avg Ticket"
                  value={formatCurrency(avgTicket)}
                  change="Per transaction"
                  trend="neutral"
                  icon={Award}
                  delay={0.05}
                />
                <StatCard
                  label="Returning Rate"
                  value={`${retentionStats.returning}%`}
                  change={`${retentionStats.newThisMonth} new customers`}
                  trend="up"
                  icon={Repeat}
                  delay={0.1}
                />
                <StatCard
                  label="Avg Visits"
                  value={retentionStats.avgVisits}
                  change="Per customer lifetime"
                  trend="neutral"
                  icon={Users}
                  delay={0.15}
                />
              </div>

              <Card className="p-4">
                <p className="text-sm text-[var(--text-muted)]">
                  Download detailed reports from the tabs above —{" "}
                  <strong className="text-[var(--text)]">POS Sales</strong>,{" "}
                  <strong className="text-[var(--text)]">Staff</strong>,{" "}
                  <strong className="text-[var(--text)]">Customers</strong>, plus
                  Services, Products, Commission, Queue, and Appointments.
                  Each report supports Excel and PDF export.
                </p>
              </Card>

              <div className="grid gap-6 lg:grid-cols-2">
                <SalesChart data={SALES_TREND} title="Weekly Sales Trend" />
                <PeakHoursChart data={PEAK_HOURS} />
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="h-4 w-4 text-[var(--gold)]" />
                      Top Staff
                    </CardTitle>
                  </CardHeader>
                  <div className="space-y-3">
                    {topStaff.map((entry, i) => (
                      <motion.div
                        key={entry.staff.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center gap-3 rounded-xl bg-[var(--bg-muted)]/50 p-3"
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--gold)]/15 text-xs font-bold text-[var(--gold-soft)]">
                          {i + 1}
                        </span>
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--gold)]/10 font-display text-[10px] font-semibold text-[var(--gold-soft)]">
                          {initials(entry.staff.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {entry.staff.name}
                          </p>
                          <p className="text-xs text-[var(--text-faint)]">
                            {entry.count} sales
                          </p>
                        </div>
                        <p className="font-semibold text-[var(--gold-soft)]">
                          {formatCurrency(entry.total)}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Scissors className="h-4 w-4 text-[var(--gold)]" />
                      Top Services
                    </CardTitle>
                  </CardHeader>
                  <div className="space-y-4">
                    {TOP_SERVICES.map((svc, i) => (
                      <div key={svc.name}>
                        <div className="mb-1 flex justify-between text-sm">
                          <span>{svc.name}</span>
                          <span className="text-[var(--text-muted)]">
                            {svc.count}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                          <motion.div
                            className="h-full rounded-full gold-gradient"
                            initial={{ width: 0 }}
                            animate={{
                              width: `${(svc.count / maxServiceCount) * 100}%`,
                            }}
                            transition={{ delay: 0.2 + i * 0.05 }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Repeat className="h-4 w-4 text-[var(--gold)]" />
                      Retention
                    </CardTitle>
                  </CardHeader>
                  <div className="space-y-4">
                    <div className="rounded-xl border border-[var(--gold)]/20 bg-[var(--gold)]/5 p-4 text-center">
                      <p className="font-display text-4xl font-bold text-[var(--gold-soft)]">
                        {retentionStats.returning}%
                      </p>
                      <p className="mt-1 text-sm text-[var(--text-muted)]">
                        Returning customer rate
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-[var(--bg-muted)] p-3">
                        <p className="text-xs text-[var(--text-faint)]">
                          New (≤2 visits)
                        </p>
                        <p className="font-display text-xl font-semibold">
                          {retentionStats.newThisMonth}
                        </p>
                      </div>
                      <div className="rounded-xl bg-[var(--bg-muted)] p-3">
                        <p className="text-xs text-[var(--text-faint)]">Members</p>
                        <p className="font-display text-xl font-semibold">
                          {
                            CUSTOMERS.filter((c) => c.membership !== "none")
                              .length
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {activeReport && (
            <ReportPanel
              report={activeReport}
              exporting={exporting}
              onExcel={() => void handleExport("excel")}
              onPdf={() => void handleExport("pdf")}
            />
          )}
        </div>
      </PageTransition>
    </>
  );
}

function ReportPanel({
  report,
  exporting,
  onExcel,
  onPdf,
}: {
  report: BuiltReport;
  exporting: "excel" | "pdf" | null;
  onExcel: () => void;
  onPdf: () => void;
}) {
  return (
    <div className="space-y-4">
      <Card className="p-4 md:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold">{report.title}</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {report.description}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="default">{report.rows.length} rows</Badge>
              {report.summary?.slice(0, 3).map((item) => (
                <Badge key={item.label} variant="gold">
                  {item.label}: {item.value}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={onExcel}
              disabled={exporting !== null || report.rows.length === 0}
            >
              <FileSpreadsheet className="h-4 w-4" />
              {exporting === "excel" ? "Preparing…" : "Download Excel"}
            </Button>
            <Button
              onClick={onPdf}
              disabled={exporting !== null || report.rows.length === 0}
            >
              <FileText className="h-4 w-4" />
              {exporting === "pdf" ? "Preparing…" : "Download PDF"}
            </Button>
          </div>
        </div>
      </Card>

      {report.summary && report.summary.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {report.summary.map((item) => (
            <Card key={item.label} className="p-4">
              <p className="text-xs uppercase tracking-wide text-[var(--text-faint)]">
                {item.label}
              </p>
              <p className="mt-1 font-display text-lg font-semibold">
                {item.value}
              </p>
            </Card>
          ))}
        </div>
      )}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--bg-muted)] text-xs uppercase tracking-wide text-[var(--text-faint)]">
              <tr>
                {report.columns.map((col) => (
                  <th
                    key={col.key}
                    className={`whitespace-nowrap px-4 py-3 font-medium ${
                      col.align === "right" ? "text-right" : ""
                    }`}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.rows.length === 0 && (
                <tr>
                  <td
                    colSpan={report.columns.length}
                    className="px-4 py-10 text-center text-[var(--text-muted)]"
                  >
                    No data for this report yet.
                  </td>
                </tr>
              )}
              {report.rows.map((row, idx) => (
                <tr
                  key={idx}
                  className="border-t border-[var(--border)] hover:bg-[var(--bg-muted)]/40"
                >
                  {report.columns.map((col) => (
                    <td
                      key={col.key}
                      className={`whitespace-nowrap px-4 py-2.5 ${
                        col.align === "right" ? "text-right tabular-nums" : ""
                      }`}
                    >
                      {row[col.key] ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

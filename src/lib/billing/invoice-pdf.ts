import { jsPDF } from "jspdf";
import type { Invoice } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

const STATUS_LABEL: Record<Invoice["status"], string> = {
  pending: "Pending",
  paid: "Paid",
  overdue: "Overdue",
};

/** A single-invoice PDF, generated client-side — same jsPDF dependency the
 * reports export already uses, just a document layout instead of a table. */
export function downloadInvoicePdf(invoice: Invoice) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const marginX = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 64;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(28, 25, 23);
  doc.text("BarberFlow", marginX, y);

  doc.setFontSize(12);
  doc.setTextColor(100);
  doc.text("INVOICE", pageWidth - marginX, y, { align: "right" });
  y += 36;

  const periodLabel = new Date(invoice.period).toLocaleDateString("en-MY", {
    month: "long",
    year: "numeric",
  });
  const invoiceNumber = `INV-${invoice.period.slice(0, 7)}-${invoice.tenantId}`;

  doc.setDrawColor(197, 160, 89);
  doc.setLineWidth(1.5);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 28;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("Billed to", marginX, y);
  doc.text("Invoice number", pageWidth - marginX, y, { align: "right" });
  y += 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(0);
  doc.text(invoice.tenantName, marginX, y);
  doc.setFontSize(10);
  doc.text(invoiceNumber, pageWidth - marginX, y, { align: "right" });
  y += 40;

  const rows: [string, string][] = [
    ["Billing period", periodLabel],
    ["Amount due", formatCurrency(invoice.amount)],
    ["Due date", formatDate(invoice.dueAt)],
    ["Status", STATUS_LABEL[invoice.status]],
  ];
  if (invoice.paidAt) rows.push(["Paid on", formatDate(invoice.paidAt)]);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  for (const [label, value] of rows) {
    doc.setTextColor(100);
    doc.text(label, marginX, y);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text(value, pageWidth - marginX, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    y += 22;
  }

  y += 24;
  doc.setDrawColor(230);
  doc.setLineWidth(1);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 28;

  doc.setFontSize(9);
  doc.setTextColor(140);
  doc.text(
    invoice.status === "paid"
      ? "This invoice has been paid in full. Thank you."
      : "Please settle this invoice by the due date to keep your subscription active.",
    marginX,
    y,
  );

  doc.save(`${invoiceNumber}.pdf`);
}

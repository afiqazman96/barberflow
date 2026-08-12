import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type ReportColumn = {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
};

export type ReportRow = Record<string, string | number | null | undefined>;

export type BuiltReport = {
  id: string;
  title: string;
  description: string;
  filename: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  summary?: { label: string; value: string }[];
};

function cellValue(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";
  return value;
}

export function downloadExcel(report: BuiltReport) {
  const sheetRows = report.rows.map((row) => {
    const out: Record<string, string | number> = {};
    for (const col of report.columns) {
      out[col.header] = cellValue(row[col.key]);
    }
    return out;
  });

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(sheetRows);
  XLSX.utils.book_append_sheet(workbook, sheet, report.title.slice(0, 31));

  if (report.summary?.length) {
    const summarySheet = XLSX.utils.json_to_sheet(
      report.summary.map((s) => ({ Metric: s.label, Value: s.value })),
    );
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");
  }

  XLSX.writeFile(workbook, `${report.filename}.xlsx`);
}

export function downloadPdf(
  report: BuiltReport,
  meta?: { businessName?: string; generatedAt?: string },
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const marginX = 36;
  let y = 40;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(report.title, marginX, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100);
  const subtitle = [
    meta?.businessName,
    report.description,
    `Generated ${meta?.generatedAt ?? new Date().toLocaleString("en-MY")}`,
  ]
    .filter(Boolean)
    .join(" · ");
  doc.text(subtitle, marginX, y);
  y += 16;
  doc.setTextColor(0);

  if (report.summary?.length) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Summary", marginX, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    for (const item of report.summary) {
      doc.text(`${item.label}: ${item.value}`, marginX, y);
      y += 13;
    }
    y += 6;
  }

  autoTable(doc, {
    startY: y,
    head: [report.columns.map((c) => c.header)],
    body: report.rows.map((row) =>
      report.columns.map((c) => String(cellValue(row[c.key]))),
    ),
    styles: {
      fontSize: 8,
      cellPadding: 4,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [197, 160, 89],
      textColor: [28, 25, 23],
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [252, 251, 248] },
    margin: { left: marginX, right: marginX },
  });

  doc.save(`${report.filename}.pdf`);
}

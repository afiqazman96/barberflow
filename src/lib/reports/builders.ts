import type {
  Booking,
  Customer,
  Product,
  QueueTicket,
  Sale,
  Service,
  StaffMember,
} from "@/lib/types";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { BuiltReport } from "@/lib/reports/export";

function money(n: number) {
  return formatCurrency(n);
}

export function buildSalesReport(sales: Sale[], branchName?: string): BuiltReport {
  const total = sales.reduce((sum, s) => sum + s.total, 0);
  const commission = sales.reduce((sum, s) => sum + s.commission, 0);
  const byMethod = sales.reduce(
    (acc, s) => {
      acc[s.paymentMethod] = (acc[s.paymentMethod] ?? 0) + s.total;
      return acc;
    },
    {} as Record<string, number>,
  );

  return {
    id: "sales",
    title: "POS Sales Report",
    description: branchName
      ? `All POS transactions · ${branchName}`
      : "All POS transactions",
    filename: `pos-sales-${stamp()}`,
    columns: [
      { key: "receiptNo", header: "Receipt" },
      { key: "createdAt", header: "Date/Time" },
      { key: "customerName", header: "Customer" },
      { key: "staffName", header: "Staff" },
      { key: "items", header: "Items" },
      { key: "subtotal", header: "Subtotal", align: "right" },
      { key: "discount", header: "Discount", align: "right" },
      { key: "total", header: "Total", align: "right" },
      { key: "paymentMethod", header: "Payment" },
      { key: "commission", header: "Commission", align: "right" },
    ],
    rows: sales.map((s) => ({
      receiptNo: s.receiptNo,
      createdAt: formatDateTime(s.createdAt),
      customerName: s.customerName,
      staffName: s.staffName,
      items: s.items.map((i) => `${i.name} x${i.quantity}`).join(", "),
      subtotal: money(s.subtotal),
      discount: money(s.discount),
      total: money(s.total),
      paymentMethod: s.paymentMethod.toUpperCase(),
      commission: money(s.commission),
    })),
    summary: [
      { label: "Transactions", value: String(sales.length) },
      { label: "Gross sales", value: money(total) },
      { label: "Total commission", value: money(commission) },
      { label: "Cash", value: money(byMethod.cash ?? 0) },
      { label: "Card", value: money(byMethod.card ?? 0) },
      { label: "QR", value: money(byMethod.qr ?? 0) },
    ],
  };
}

export function buildStaffReport(
  staff: StaffMember[],
  sales: Sale[],
): BuiltReport {
  const barbers = staff.filter((s) => s.role === "barber" || s.role === "owner");
  const rows = barbers.map((member) => {
    const memberSales = sales.filter((s) => s.staffId === member.id);
    const revenue = memberSales.reduce((sum, s) => sum + s.total, 0);
    const commission = memberSales.reduce((sum, s) => sum + s.commission, 0);
    return {
      name: member.name,
      role: member.role,
      email: member.email,
      phone: member.phone,
      status: member.status,
      transactions: memberSales.length,
      revenue: money(revenue),
      commission: money(commission),
      todaySales: money(member.todaySales),
      monthlySales: money(member.monthlySales),
      monthlyCommission: money(member.monthlyCommission),
      rating: member.rating,
      active: member.active ? "Yes" : "No",
    };
  });

  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
  const totalCommission = sales.reduce((sum, s) => sum + s.commission, 0);

  return {
    id: "staff",
    title: "Staff Performance Report",
    description: "Sales and commission by staff member",
    filename: `staff-performance-${stamp()}`,
    columns: [
      { key: "name", header: "Staff" },
      { key: "role", header: "Role" },
      { key: "status", header: "Status" },
      { key: "transactions", header: "Txns", align: "right" },
      { key: "revenue", header: "Revenue", align: "right" },
      { key: "commission", header: "Commission", align: "right" },
      { key: "monthlySales", header: "Monthly Sales", align: "right" },
      { key: "monthlyCommission", header: "Monthly Comm.", align: "right" },
      { key: "rating", header: "Rating", align: "right" },
      { key: "active", header: "Active" },
    ],
    rows,
    summary: [
      { label: "Staff counted", value: String(rows.length) },
      { label: "Attributed revenue", value: money(totalRevenue) },
      { label: "Attributed commission", value: money(totalCommission) },
    ],
  };
}

export function buildCustomerReport(customers: Customer[]): BuiltReport {
  const members = customers.filter((c) => c.membership !== "none").length;
  const totalSpend = customers.reduce((sum, c) => sum + c.totalSpent, 0);

  return {
    id: "customers",
    title: "Customer Report",
    description: "CRM customers, membership and lifetime value",
    filename: `customers-${stamp()}`,
    columns: [
      { key: "name", header: "Name" },
      { key: "phone", header: "Phone" },
      { key: "email", header: "Email" },
      { key: "membership", header: "Membership" },
      { key: "visits", header: "Visits", align: "right" },
      { key: "totalSpent", header: "Total Spent", align: "right" },
      { key: "lastVisit", header: "Last Visit" },
      { key: "notes", header: "Notes" },
    ],
    rows: customers.map((c) => ({
      name: c.name,
      phone: c.phone,
      email: c.email ?? "",
      membership: c.membership,
      visits: c.visits,
      totalSpent: money(c.totalSpent),
      lastVisit: c.lastVisit,
      notes: c.notes ?? "",
    })),
    summary: [
      { label: "Customers", value: String(customers.length) },
      { label: "Members", value: String(members) },
      { label: "Lifetime spend", value: money(totalSpend) },
    ],
  };
}

export function buildServiceReport(
  services: Service[],
  sales: Sale[],
): BuiltReport {
  const rows = services.map((service) => {
    const lines = sales.flatMap((s) =>
      s.items.filter((i) => i.type === "service" && i.name === service.name),
    );
    const qty = lines.reduce((sum, i) => sum + i.quantity, 0);
    const revenue = lines.reduce((sum, i) => sum + i.total, 0);
    return {
      name: service.name,
      category: service.category,
      durationMins: service.durationMins,
      price: money(service.price),
      membershipPrice: money(service.membershipPrice),
      soldQty: qty,
      revenue: money(revenue),
      popular: service.popular ? "Yes" : "No",
    };
  });

  return {
    id: "services",
    title: "Services Report",
    description: "Menu performance by service",
    filename: `services-${stamp()}`,
    columns: [
      { key: "name", header: "Service" },
      { key: "category", header: "Category" },
      { key: "durationMins", header: "Duration (min)", align: "right" },
      { key: "price", header: "Price", align: "right" },
      { key: "membershipPrice", header: "Member Price", align: "right" },
      { key: "soldQty", header: "Sold Qty", align: "right" },
      { key: "revenue", header: "Revenue", align: "right" },
      { key: "popular", header: "Popular" },
    ],
    rows,
    summary: [
      { label: "Services", value: String(services.length) },
      {
        label: "Service revenue",
        value: money(
          sales
            .flatMap((s) => s.items.filter((i) => i.type === "service"))
            .reduce((sum, i) => sum + i.total, 0),
        ),
      },
    ],
  };
}

export function buildProductReport(
  products: Product[],
  sales: Sale[],
): BuiltReport {
  const rows = products.map((product) => {
    const lines = sales.flatMap((s) =>
      s.items.filter((i) => i.type === "product" && i.name === product.name),
    );
    const qty = lines.reduce((sum, i) => sum + i.quantity, 0);
    const revenue = lines.reduce((sum, i) => sum + i.total, 0);
    return {
      name: product.name,
      sku: product.sku,
      category: product.category,
      price: money(product.price),
      stock: product.stock,
      stockValue: money(product.price * product.stock),
      soldQty: qty,
      revenue: money(revenue),
    };
  });

  return {
    id: "products",
    title: "Products & Inventory Report",
    description: "Retail stock levels and product sales",
    filename: `products-inventory-${stamp()}`,
    columns: [
      { key: "name", header: "Product" },
      { key: "sku", header: "SKU" },
      { key: "category", header: "Category" },
      { key: "price", header: "Price", align: "right" },
      { key: "stock", header: "Stock", align: "right" },
      { key: "stockValue", header: "Stock Value", align: "right" },
      { key: "soldQty", header: "Sold Qty", align: "right" },
      { key: "revenue", header: "Sales Revenue", align: "right" },
    ],
    rows,
    summary: [
      { label: "SKUs", value: String(products.length) },
      {
        label: "Stock value",
        value: money(products.reduce((sum, p) => sum + p.price * p.stock, 0)),
      },
      {
        label: "Product revenue",
        value: money(
          sales
            .flatMap((s) => s.items.filter((i) => i.type === "product"))
            .reduce((sum, i) => sum + i.total, 0),
        ),
      },
    ],
  };
}

export function buildCommissionReport(sales: Sale[]): BuiltReport {
  return {
    id: "commission",
    title: "Commission Report",
    description: "Commission earned per sale",
    filename: `commission-${stamp()}`,
    columns: [
      { key: "receiptNo", header: "Receipt" },
      { key: "createdAt", header: "Date/Time" },
      { key: "staffName", header: "Staff" },
      { key: "customerName", header: "Customer" },
      { key: "total", header: "Sale Total", align: "right" },
      { key: "commission", header: "Commission", align: "right" },
      { key: "rate", header: "Est. Rate", align: "right" },
    ],
    rows: sales.map((s) => ({
      receiptNo: s.receiptNo,
      createdAt: formatDateTime(s.createdAt),
      staffName: s.staffName,
      customerName: s.customerName,
      total: money(s.total),
      commission: money(s.commission),
      rate:
        s.total > 0
          ? `${Math.round((s.commission / s.total) * 100)}%`
          : "0%",
    })),
    summary: [
      {
        label: "Total commission",
        value: money(sales.reduce((sum, s) => sum + s.commission, 0)),
      },
      { label: "Sales lines", value: String(sales.length) },
    ],
  };
}

export function buildQueueReport(queue: QueueTicket[]): BuiltReport {
  const waiting = queue.filter((q) => q.status === "waiting").length;
  const completed = queue.filter((q) => q.status === "completed").length;
  const noShow = queue.filter((q) => q.status === "no-show").length;

  return {
    id: "queue",
    title: "Queue Report",
    description: "Walk-in / queue tickets and wait metrics",
    filename: `queue-${stamp()}`,
    columns: [
      { key: "number", header: "Ticket #" },
      { key: "createdAt", header: "Created" },
      { key: "customerName", header: "Customer" },
      { key: "customerPhone", header: "Phone" },
      { key: "services", header: "Services" },
      { key: "status", header: "Status" },
      { key: "source", header: "Source" },
      { key: "estimatedWaitMins", header: "Est. Wait (min)", align: "right" },
    ],
    rows: queue.map((q) => ({
      number: q.number,
      createdAt: formatDateTime(q.createdAt),
      customerName: q.customerName,
      customerPhone: q.customerPhone,
      services: q.serviceNames.join(", "),
      status: q.status,
      source: q.source,
      estimatedWaitMins: q.estimatedWaitMins,
    })),
    summary: [
      { label: "Tickets", value: String(queue.length) },
      { label: "Waiting", value: String(waiting) },
      { label: "Completed", value: String(completed) },
      { label: "No-show", value: String(noShow) },
    ],
  };
}

export function buildBookingReport(bookings: Booking[]): BuiltReport {
  const confirmed = bookings.filter((b) => b.status === "confirmed").length;
  const completed = bookings.filter((b) => b.status === "completed").length;
  const noShow = bookings.filter((b) => b.status === "no-show").length;

  return {
    id: "bookings",
    title: "Appointments Report",
    description: "Booked appointments by status and staff",
    filename: `appointments-${stamp()}`,
    columns: [
      { key: "date", header: "Date" },
      { key: "time", header: "Time" },
      { key: "customerName", header: "Customer" },
      { key: "customerPhone", header: "Phone" },
      { key: "services", header: "Services" },
      { key: "staffName", header: "Staff" },
      { key: "durationMins", header: "Duration", align: "right" },
      { key: "status", header: "Status" },
    ],
    rows: bookings.map((b) => ({
      date: b.date,
      time: b.time,
      customerName: b.customerName,
      customerPhone: b.customerPhone,
      services: b.serviceNames.join(", "),
      staffName: b.staffName,
      durationMins: b.durationMins,
      status: b.status,
    })),
    summary: [
      { label: "Bookings", value: String(bookings.length) },
      { label: "Confirmed", value: String(confirmed) },
      { label: "Completed", value: String(completed) },
      { label: "No-show", value: String(noShow) },
    ],
  };
}

function stamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

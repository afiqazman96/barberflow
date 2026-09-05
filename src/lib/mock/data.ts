import type {
  Booking,
  Branch,
  Chair,
  CommissionRule,
  Customer,
  MembershipPlan,
  Package,
  Product,
  QueueTicket,
  Sale,
  Service,
  StaffMember,
  SupportTicket,
  Tenant,
} from "@/lib/types";

/**
 * Mock fixtures are pinned to the *calendar day* the demo is opened, so
 * "today / this-week" filters and date labels stay sensible instead of
 * counting from a frozen 2026-07-30. Timestamps keep the app's local-naive
 * ISO shape ("YYYY-MM-DDTHH:mm:ss") — the same shape the API is expected to
 * return.
 *
 * The anchor is midnight, not `new Date()`: the server evaluates this module
 * once at start-up and the browser evaluates it again on load, often an hour
 * or more apart. Anchoring to the date (which both agree on) and using fixed
 * clock times keeps the server render and the client hydration identical.
 * Live "x minutes elapsed" counters are computed in the components against
 * the real clock, not from these strings.
 */
const MOCK_DAY = (() => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
})();

function mpad(n: number): string {
  return String(n).padStart(2, "0");
}

/** `YYYY-MM-DD`, `days` days from today (negative = past). */
function dayOffset(days: number): string {
  const d = new Date(MOCK_DAY);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${mpad(d.getMonth() + 1)}-${mpad(d.getDate())}`;
}

/** Local-naive ISO at a fixed clock time, `days` days from today. */
function dateAt(days: number, hour: number, minute = 0): string {
  return `${dayOffset(days)}T${mpad(hour)}:${mpad(minute)}:00`;
}

/**
 * A recent time earlier *today* — used for live queue tickets. `minsBack` is
 * measured from a nominal "now" of 15:00 so the values read as a normal
 * afternoon; the actual elapsed timer in the UI still runs off the real clock.
 */
function earlierToday(minsBack: number): string {
  const total = 15 * 60 - minsBack;
  return dateAt(0, Math.floor(total / 60), total % 60);
}

export const TODAY = dayOffset(0);

export const TENANT: Tenant = {
  id: "t1",
  name: "Fade House",
  slug: "fade-house",
  plan: "Growth",
  packageId: "pkg2",
  status: "active",
  branches: 3,
  staff: 14,
  mrr: 449,
  ownerName: "Rizal Rahman",
  ownerEmail: "rizal@fadehouse.my",
  billing: "monthly",
  createdAt: "2025-03-12",
};

export const BRANCHES: Branch[] = [
  {
    id: "b1",
    tenantId: "t1",
    name: "Fade House KL",
    address: "88 Jalan Bukit Bintang, Lot 12",
    city: "Kuala Lumpur",
    phone: "+60 3-2141 8890",
    status: "open",
    openHours: "10:00 – 22:00",
    avgWaitMins: 18,
    queueCount: 7,
    chairs: 3,
  },
  {
    id: "b2",
    tenantId: "t1",
    name: "Fade House Shah Alam",
    address: "Seksyen 13, Plaza Alam Sentral",
    city: "Shah Alam",
    phone: "+60 3-5523 4411",
    status: "open",
    openHours: "11:00 – 21:00",
    avgWaitMins: 12,
    queueCount: 4,
    chairs: 3,
  },
  {
    id: "b3",
    tenantId: "t1",
    name: "Fade House Melaka",
    address: "Jonker Walk, Lot 5",
    city: "Melaka",
    phone: "+60 6-281 3344",
    status: "busy",
    openHours: "10:00 – 21:00",
    avgWaitMins: 28,
    queueCount: 9,
    chairs: 2,
  },
];

export const CHAIRS: Chair[] = [
  { id: "ch1", branchId: "b1", number: 1, label: "Chair 1", staffId: "s1" },
  { id: "ch2", branchId: "b1", number: 2, label: "Chair 2", staffId: "s2" },
  { id: "ch3", branchId: "b1", number: 3, label: "Chair 3", staffId: "s3" },
];

export const STAFF: StaffMember[] = [
  {
    id: "s0",
    branchId: "b1",
    name: "Rizal Rahman",
    role: "owner",
    phone: "+60 12-300 1001",
    email: "rizal@fadehouse.my",
    password: "demo1234",
    active: true,
    status: "available",
    chairId: null,
    specialty: "Operations",
    todaySales: 4280,
    todayCommission: 0,
    todayCustomers: 32,
    monthlySales: 86400,
    monthlyCommission: 0,
    monthlyTarget: 100000,
    rating: 5,
  },
  {
    id: "c1",
    branchId: "b1",
    name: "Siti Nurhaliza",
    role: "cashier",
    phone: "+60 12-300 2002",
    email: "siti@fadehouse.my",
    password: "demo1234",
    active: true,
    status: "available",
    chairId: null,
    specialty: "Front Desk",
    todaySales: 4280,
    todayCommission: 0,
    todayCustomers: 32,
    monthlySales: 86400,
    monthlyCommission: 0,
    monthlyTarget: 0,
    rating: 4.9,
  },
  {
    id: "s1",
    branchId: "b1",
    name: "Adam Iskandar",
    role: "barber",
    phone: "+60 12-111 2233",
    email: "adam@fadehouse.my",
    password: "demo1234",
    active: true,
    status: "busy",
    chairId: "ch1",
    specialty: "Skin Fade · Beard",
    todaySales: 680,
    todayCommission: 204,
    todayCustomers: 8,
    monthlySales: 12400,
    monthlyCommission: 3720,
    monthlyTarget: 15000,
    rating: 4.9,
  },
  {
    id: "s2",
    branchId: "b1",
    name: "Hafiz Rahman",
    role: "barber",
    phone: "+60 12-444 5566",
    email: "hafiz@fadehouse.my",
    password: "demo1234",
    active: true,
    status: "available",
    chairId: "ch2",
    specialty: "Classic Cut · Styling",
    todaySales: 540,
    todayCommission: 162,
    todayCustomers: 6,
    monthlySales: 11200,
    monthlyCommission: 3360,
    monthlyTarget: 14000,
    rating: 4.8,
  },
  {
    id: "s3",
    branchId: "b1",
    name: "Amir Zulkifli",
    role: "barber",
    phone: "+60 12-777 8899",
    email: "amir@fadehouse.my",
    password: "demo1234",
    active: true,
    status: "break",
    chairId: "ch3",
    specialty: "Taper · Color",
    todaySales: 420,
    todayCommission: 126,
    todayCustomers: 5,
    monthlySales: 9800,
    monthlyCommission: 2940,
    monthlyTarget: 12000,
    rating: 4.7,
  },
];

export const SERVICES: Service[] = [
  {
    id: "sv1",
    name: "Signature Fade",
    category: "Haircut",
    durationMins: 45,
    price: 45,
    membershipPrice: 38,
    popular: true,
  },
  {
    id: "sv2",
    name: "Classic Haircut",
    category: "Haircut",
    durationMins: 40,
    price: 38,
    membershipPrice: 32,
    popular: true,
  },
  {
    id: "sv3",
    name: "Beard Trim & Shape",
    category: "Beard",
    durationMins: 25,
    price: 28,
    membershipPrice: 22,
  },
  {
    id: "sv4",
    name: "Hot Towel Shave",
    category: "Beard",
    durationMins: 35,
    price: 42,
    membershipPrice: 35,
  },
  {
    id: "sv5",
    name: "Hair + Beard Combo",
    category: "Combo",
    durationMins: 60,
    price: 65,
    membershipPrice: 55,
    popular: true,
  },
  {
    id: "sv6",
    name: "Kids Cut",
    category: "Haircut",
    durationMins: 30,
    price: 28,
    membershipPrice: 24,
  },
  {
    id: "sv7",
    name: "Hair Color",
    category: "Color",
    durationMins: 90,
    price: 120,
    membershipPrice: 99,
  },
  {
    id: "sv8",
    name: "Scalp Treatment",
    category: "Treatment",
    durationMins: 40,
    price: 55,
    membershipPrice: 45,
  },
];

export const PRODUCTS: Product[] = [
  {
    id: "p1",
    name: "Matte Clay Pomade",
    category: "Styling",
    price: 48,
    stock: 32,
    sku: "STY-001",
  },
  {
    id: "p2",
    name: "Beard Oil — Cedar",
    category: "Beard",
    price: 55,
    stock: 18,
    sku: "BRD-002",
  },
  {
    id: "p3",
    name: "Sea Salt Spray",
    category: "Styling",
    price: 42,
    stock: 24,
    sku: "STY-003",
  },
  {
    id: "p4",
    name: "Shampoo — Daily",
    category: "Care",
    price: 38,
    stock: 40,
    sku: "CARE-004",
  },
  {
    id: "p5",
    name: "Aftershave Balm",
    category: "Care",
    price: 36,
    stock: 15,
    sku: "CARE-005",
  },
  {
    id: "p6",
    name: "Hair Powder",
    category: "Styling",
    price: 45,
    stock: 8,
    sku: "STY-006",
  },
];

const firstNames = [
  "Aiman",
  "Daniel",
  "Faris",
  "Haziq",
  "Irfan",
  "Johan",
  "Khairul",
  "Luqman",
  "Marcus",
  "Nabil",
  "Omar",
  "Putra",
  "Qayyum",
  "Ryan",
  "Syafiq",
  "Taufik",
  "Umar",
  "Victor",
  "Wan",
  "Zain",
];
const lastNames = [
  "Abdullah",
  "Chen",
  "Hassan",
  "Ibrahim",
  "Lee",
  "Lim",
  "Ng",
  "Rahman",
  "Tan",
  "Wong",
];

function makeCustomers(): Customer[] {
  const tiers: Customer["membership"][] = [
    "none",
    "none",
    "none",
    "silver",
    "silver",
    "gold",
    "platinum",
  ];
  return Array.from({ length: 80 }, (_, i) => {
    const fn = firstNames[i % firstNames.length];
    const ln = lastNames[i % lastNames.length];
    const visits = Math.floor(Math.random() * 40) + 1;
    return {
      id: `cust${i + 1}`,
      name: `${fn} ${ln}`,
      phone: `+60 1${(i % 9) + 1}-${String(1000 + i).slice(-4)} ${String(2000 + i).slice(-4)}`,
      email: `${fn.toLowerCase()}.${ln.toLowerCase()}@email.com`,
      membership: tiers[i % tiers.length],
      visits,
      totalSpent: visits * (35 + (i % 40)),
      lastVisit: dayOffset(-((i % 28) + 1)),
      preferredStaffId: i % 3 === 0 ? "s1" : i % 3 === 1 ? "s2" : "s3",
    };
  });
}

export const CUSTOMERS = makeCustomers();

export const QUEUE: QueueTicket[] = [
  {
    id: "q1",
    number: "A018",
    branchId: "b1",
    customerId: "cust1",
    customerName: "Aiman Abdullah",
    customerPhone: "+60 11-1001 2001",
    serviceIds: ["sv1"],
    serviceNames: ["Signature Fade"],
    preferredStaffId: "s1",
    assignedStaffId: "s1",
    chairId: "ch1",
    status: "in-service",
    estimatedWaitMins: 0,
    createdAt: earlierToday(38),
    startedAt: earlierToday(21),
    source: "qr",
  },
  {
    id: "q2",
    number: "A019",
    branchId: "b1",
    customerId: "cust2",
    customerName: "Daniel Chen",
    customerPhone: "+60 12-1002 2002",
    serviceIds: ["sv5"],
    serviceNames: ["Hair + Beard Combo"],
    preferredStaffId: null,
    assignedStaffId: null,
    chairId: null,
    status: "waiting",
    estimatedWaitMins: 12,
    createdAt: earlierToday(14),
    source: "cashier",
  },
  {
    id: "q3",
    number: "A020",
    branchId: "b1",
    customerId: "cust3",
    customerName: "Faris Hassan",
    customerPhone: "+60 13-1003 2003",
    serviceIds: ["sv2", "sv3"],
    serviceNames: ["Classic Haircut", "Beard Trim & Shape"],
    preferredStaffId: "s2",
    assignedStaffId: "s2",
    chairId: null,
    status: "waiting",
    estimatedWaitMins: 8,
    createdAt: earlierToday(11),
    source: "booking",
  },
  {
    id: "q4",
    number: "A021",
    branchId: "b1",
    customerId: "cust4",
    customerName: "Haziq Ibrahim",
    customerPhone: "+60 14-1004 2004",
    serviceIds: ["sv1"],
    serviceNames: ["Signature Fade"],
    preferredStaffId: null,
    assignedStaffId: null,
    chairId: null,
    status: "waiting",
    estimatedWaitMins: 22,
    createdAt: earlierToday(7),
    source: "qr",
  },
  {
    id: "q5",
    number: "A022",
    branchId: "b1",
    customerId: "cust5",
    customerName: "Irfan Lee",
    customerPhone: "+60 15-1005 2005",
    serviceIds: ["sv6"],
    serviceNames: ["Kids Cut"],
    preferredStaffId: "s3",
    assignedStaffId: null,
    chairId: null,
    status: "waiting",
    estimatedWaitMins: 35,
    createdAt: earlierToday(4),
    source: "cashier",
  },
  {
    id: "q6",
    number: "A017",
    branchId: "b1",
    customerId: "cust6",
    customerName: "Johan Lim",
    customerPhone: "+60 16-1006 2006",
    serviceIds: ["sv2"],
    serviceNames: ["Classic Haircut"],
    preferredStaffId: "s2",
    assignedStaffId: "s2",
    chairId: "ch2",
    status: "awaiting-payment",
    estimatedWaitMins: 0,
    createdAt: earlierToday(70),
    startedAt: earlierToday(52),
    source: "qr",
  },
  {
    id: "q7",
    number: "A016",
    branchId: "b1",
    customerId: "cust7",
    customerName: "Khairul Ng",
    customerPhone: "+60 17-1007 2007",
    serviceIds: ["sv5"],
    serviceNames: ["Hair + Beard Combo"],
    preferredStaffId: null,
    assignedStaffId: "s1",
    chairId: "ch1",
    status: "completed",
    estimatedWaitMins: 0,
    createdAt: earlierToday(155),
    startedAt: earlierToday(133),
    source: "booking",
  },
];

export const BOOKINGS: Booking[] = Array.from({ length: 20 }, (_, i) => {
  const cust = CUSTOMERS[i + 10];
  const staff = STAFF[2 + (i % 3)];
  const hour = 10 + (i % 8);
  const statuses: Booking["status"][] = [
    "confirmed",
    "confirmed",
    "confirmed",
    "checked-in",
    "completed",
    "no-show",
  ];
  // Keep each booking's date consistent with its status: past days are done or
  // no-shows, today holds the confirmed / checked-in ones, and a few sit ahead.
  const dayShift = [0, 1, 3, 0, -1, -2][i % 6];
  return {
    id: `bk${i + 1}`,
    branchId: "b1",
    customerId: cust.id,
    customerName: cust.name,
    customerPhone: cust.phone,
    serviceIds: [i % 2 === 0 ? "sv1" : "sv5"],
    serviceNames: [i % 2 === 0 ? "Signature Fade" : "Hair + Beard Combo"],
    staffId: i % 4 === 0 ? null : staff.id,
    staffName: i % 4 === 0 ? "Any Barber" : staff.name,
    date: dayOffset(dayShift),
    time: `${String(hour).padStart(2, "0")}:${i % 2 === 0 ? "00" : "30"}`,
    durationMins: i % 2 === 0 ? 45 : 60,
    gracePeriodMins: 10,
    status: statuses[i % statuses.length],
  };
});

export const SALES: Sale[] = Array.from({ length: 24 }, (_, i) => {
  const cust = CUSTOMERS[i];
  const staff = STAFF[2 + (i % 3)];
  // First ten land today for the day's tallies; the rest fan out over the
  // last month so date-range reports have something to filter.
  const daysBack = i < 10 ? 0 : (i - 9) * 2;
  const service = SERVICES[i % SERVICES.length];
  const hasProduct = i % 3 === 0;
  const product = PRODUCTS[i % PRODUCTS.length];
  const subtotal = service.price + (hasProduct ? product.price : 0);
  const discount = i % 5 === 0 ? 5 : 0;
  const total = subtotal - discount;
  const commission = Math.round(total * 0.3 * 100) / 100;
  return {
    id: `sale${i + 1}`,
    branchId: "b1",
    customerId: cust.id,
    customerName: cust.name,
    staffId: staff.id,
    staffName: staff.name,
    items: [
      {
        id: `si${i}-1`,
        type: "service" as const,
        name: service.name,
        quantity: 1,
        unitPrice: service.price,
        total: service.price,
      },
      ...(hasProduct
        ? [
            {
              id: `si${i}-2`,
              type: "product" as const,
              name: product.name,
              quantity: 1,
              unitPrice: product.price,
              total: product.price,
            },
          ]
        : []),
    ],
    subtotal,
    discount,
    voucher: 0,
    total,
    paymentMethod: (["cash", "card", "qr"] as const)[i % 3],
    commission,
    createdAt: dateAt(-daysBack, 9 + (i % 10), (i * 7) % 60),
    receiptNo: `FH-KL-${String(1040 + i)}`,
  };
});

export const COMMISSION_RULES: CommissionRule[] = [
  {
    id: "cr1",
    name: "Service Default",
    type: "percentage",
    value: 30,
    appliesTo: "service",
    active: true,
  },
  {
    id: "cr2",
    name: "Product Default",
    type: "percentage",
    value: 15,
    appliesTo: "product",
    active: true,
  },
  {
    id: "cr3",
    name: "Signature Fade Boost",
    type: "service-based",
    value: 15,
    appliesTo: "service",
    serviceId: "sv1",
    active: true,
  },
  {
    id: "cr4",
    name: "Adam Override",
    type: "percentage",
    value: 35,
    appliesTo: "all",
    staffId: "s1",
    active: true,
  },
  {
    id: "cr5",
    name: "July Campaign Bonus",
    type: "fixed",
    value: 5,
    appliesTo: "service",
    active: true,
  },
];

export const MEMBERSHIP_PLANS: MembershipPlan[] = [
  {
    id: "m1",
    name: "Silver",
    tier: "silver",
    price: 49,
    discountPercent: 10,
    benefits: ["10% off services", "Priority SMS"],
    members: 124,
  },
  {
    id: "m2",
    name: "Gold",
    tier: "gold",
    price: 89,
    discountPercent: 15,
    benefits: ["15% off services", "Free beard trim/mo", "Priority queue"],
    members: 68,
  },
  {
    id: "m3",
    name: "Platinum",
    tier: "platinum",
    price: 149,
    discountPercent: 20,
    benefits: [
      "20% off all",
      "2 free cuts/mo",
      "Skip queue",
      "Product discounts",
    ],
    members: 22,
  },
];

export const PACKAGES: Package[] = [
  {
    id: "pkg1",
    name: "Starter",
    price: 199,
    yearlyPrice: 1990,
    billing: "monthly",
    maxBranches: 1,
    maxStaff: 5,
    trialDays: 14,
    features: ["Queue & Booking", "POS", "Basic Reports", "1 Branch"],
  },
  {
    id: "pkg2",
    name: "Growth",
    price: 449,
    yearlyPrice: 4490,
    billing: "monthly",
    maxBranches: 5,
    maxStaff: 25,
    popular: true,
    trialDays: 14,
    features: [
      "Everything in Starter",
      "Commission Engine",
      "Multi-branch",
      "Inventory",
      "Membership",
      "Advanced Analytics",
    ],
  },
  {
    id: "pkg3",
    name: "Enterprise",
    price: 999,
    yearlyPrice: 9990,
    billing: "monthly",
    maxBranches: 50,
    maxStaff: 200,
    trialDays: 30,
    features: [
      "Everything in Growth",
      "Custom Features",
      "Dedicated Support",
      "API Access",
      "White Label",
      "SLA 99.9%",
    ],
  },
];

export const TENANTS: Tenant[] = [
  TENANT,
  {
    id: "t2",
    name: "Blade & Co",
    slug: "blade-co",
    plan: "Starter",
    packageId: "pkg1",
    status: "active",
    branches: 1,
    staff: 4,
    mrr: 199,
    ownerName: "Lee Wei",
    ownerEmail: "lee@bladeco.my",
    billing: "monthly",
    createdAt: "2025-08-01",
  },
  {
    id: "t3",
    name: "Gentlemen's Room",
    slug: "gentlemens-room",
    plan: "Growth",
    packageId: "pkg2",
    status: "trial",
    branches: 2,
    staff: 9,
    mrr: 0,
    ownerName: "Faizal Noor",
    ownerEmail: "faizal@gentlemens.my",
    billing: "monthly",
    trialEndsAt: "2026-08-14",
    createdAt: "2026-07-15",
  },
  {
    id: "t4",
    name: "Cut Theory",
    slug: "cut-theory",
    plan: "Enterprise",
    packageId: "pkg3",
    status: "active",
    branches: 12,
    staff: 68,
    mrr: 999,
    ownerName: "Sarah Tan",
    ownerEmail: "sarah@cuttheory.com",
    billing: "monthly",
    createdAt: "2024-11-20",
  },
  {
    id: "t5",
    name: "Local Barber PJ",
    slug: "local-pj",
    plan: "Starter",
    packageId: "pkg1",
    status: "suspended",
    branches: 1,
    staff: 3,
    mrr: 0,
    ownerName: "Azman",
    ownerEmail: "azman@localpj.my",
    billing: "monthly",
    createdAt: "2025-01-08",
  },
];

export const SUPPORT_TICKETS: SupportTicket[] = [
  {
    id: "tk1",
    tenantId: "t1",
    tenantName: "Fade House",
    subject: "Need extra branch seats",
    priority: "medium",
    status: "open",
    createdAt: "2026-07-29",
  },
  {
    id: "tk2",
    tenantId: "t2",
    tenantName: "Blade & Co",
    subject: "POS receipt printer pairing",
    priority: "high",
    status: "in-progress",
    createdAt: "2026-07-28",
  },
  {
    id: "tk3",
    tenantId: "t4",
    tenantName: "Cut Theory",
    subject: "API webhook delay",
    priority: "high",
    status: "open",
    createdAt: "2026-07-30",
  },
  {
    id: "tk4",
    tenantId: "t3",
    tenantName: "Gentlemen's Room",
    subject: "Trial extension request",
    priority: "low",
    status: "resolved",
    createdAt: "2026-07-22",
  },
];

export const DEFAULT_FEATURE_MATRIX: Record<
  string,
  Record<string, boolean>
> = {
  pkg1: {
    queue: true,
    booking: true,
    pos: true,
    commission: false,
    inventory: false,
    membership: false,
    analytics: false,
    api: false,
    "white-label": false,
  },
  pkg2: {
    queue: true,
    booking: true,
    pos: true,
    commission: true,
    inventory: true,
    membership: true,
    analytics: true,
    api: false,
    "white-label": false,
  },
  pkg3: {
    queue: true,
    booking: true,
    pos: true,
    commission: true,
    inventory: true,
    membership: true,
    analytics: true,
    api: true,
    "white-label": true,
  },
};

export const SALES_TREND = [
  { day: "Mon", sales: 3200 },
  { day: "Tue", sales: 2800 },
  { day: "Wed", sales: 4100 },
  { day: "Thu", sales: 3900 },
  { day: "Fri", sales: 5200 },
  { day: "Sat", sales: 6800 },
  { day: "Sun", sales: 4500 },
];

export const PEAK_HOURS = [
  { hour: "10", count: 4 },
  { hour: "11", count: 6 },
  { hour: "12", count: 8 },
  { hour: "13", count: 7 },
  { hour: "14", count: 9 },
  { hour: "15", count: 11 },
  { hour: "16", count: 14 },
  { hour: "17", count: 16 },
  { hour: "18", count: 18 },
  { hour: "19", count: 15 },
  { hour: "20", count: 10 },
  { hour: "21", count: 5 },
];

export const TOP_SERVICES = [
  { name: "Signature Fade", count: 142 },
  { name: "Hair + Beard", count: 98 },
  { name: "Classic Cut", count: 87 },
  { name: "Beard Trim", count: 64 },
  { name: "Kids Cut", count: 41 },
];

export const TIME_SLOTS = [
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
  "20:30",
];

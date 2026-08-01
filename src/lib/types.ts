export type UserRole =
  | "super-admin"
  | "owner"
  | "cashier"
  | "staff"
  | "customer";

export type StaffStatus = "off-duty" | "available" | "busy" | "break";

export type QueueStatus =
  | "waiting"
  | "called"
  | "in-service"
  | "awaiting-payment"
  | "completed"
  | "no-show"
  | "cancelled";

export type BookingStatus =
  | "confirmed"
  | "checked-in"
  | "in-service"
  | "completed"
  | "no-show"
  | "cancelled";

export type PaymentMethod = "cash" | "card" | "qr";

export type CommissionType =
  | "fixed"
  | "percentage"
  | "service-based"
  | "product-based";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  /** Display name of package (denormalized) */
  plan: string;
  /** Links to Package.id */
  packageId: string;
  status: "active" | "trial" | "suspended";
  branches: number;
  staff: number;
  /** Monthly recurring revenue — 0 while on trial */
  mrr: number;
  ownerName: string;
  ownerEmail: string;
  billing: "monthly" | "yearly";
  trialEndsAt?: string;
  createdAt: string;
}

export type FeatureKey =
  | "queue"
  | "booking"
  | "pos"
  | "commission"
  | "inventory"
  | "membership"
  | "analytics"
  | "api"
  | "white-label";

export const FEATURE_KEYS: { key: FeatureKey; label: string }[] = [
  { key: "queue", label: "Queue & Walk-in" },
  { key: "booking", label: "Appointments" },
  { key: "pos", label: "POS & Payments" },
  { key: "commission", label: "Commission Engine" },
  { key: "inventory", label: "Inventory" },
  { key: "membership", label: "Membership" },
  { key: "analytics", label: "Advanced Analytics" },
  { key: "api", label: "API Access" },
  { key: "white-label", label: "White Label" },
];

export interface Package {
  id: string;
  name: string;
  price: number;
  yearlyPrice: number;
  billing: "monthly" | "yearly";
  features: string[];
  popular?: boolean;
  maxBranches: number;
  maxStaff: number;
  trialDays: number;
}

export interface SupportTicket {
  id: string;
  tenantId: string;
  tenantName: string;
  subject: string;
  priority: "low" | "medium" | "high";
  status: "open" | "in-progress" | "resolved";
  createdAt: string;
}

export interface Branch {
  id: string;
  tenantId: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  status: "open" | "closed" | "busy";
  openHours: string;
  avgWaitMins: number;
  queueCount: number;
  chairs: number;
}

export interface Chair {
  id: string;
  branchId: string;
  number: number;
  label: string;
  staffId: string | null;
}

export interface StaffMember {
  id: string;
  branchId: string;
  name: string;
  role: "owner" | "cashier" | "barber";
  phone: string;
  email: string;
  /** Demo credential — replace with hashed auth on backend */
  password: string;
  /** Soft-disable login without deleting the profile */
  active: boolean;
  mustChangePassword?: boolean;
  avatar?: string;
  status: StaffStatus;
  chairId: string | null;
  specialty: string;
  todaySales: number;
  todayCommission: number;
  todayCustomers: number;
  monthlySales: number;
  monthlyCommission: number;
  monthlyTarget: number;
  rating: number;
}

export interface Service {
  id: string;
  name: string;
  category: string;
  durationMins: number;
  price: number;
  membershipPrice: number;
  popular?: boolean;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  sku: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  membership: "none" | "silver" | "gold" | "platinum";
  visits: number;
  totalSpent: number;
  lastVisit: string;
  preferredStaffId?: string;
  notes?: string;
}

export interface QueueTicket {
  id: string;
  number: string;
  branchId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  serviceIds: string[];
  serviceNames: string[];
  preferredStaffId: string | null;
  assignedStaffId: string | null;
  chairId: string | null;
  status: QueueStatus;
  estimatedWaitMins: number;
  createdAt: string;
  startedAt?: string;
  source: "qr" | "cashier" | "booking";
}

export interface Booking {
  id: string;
  branchId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  serviceIds: string[];
  serviceNames: string[];
  staffId: string | null;
  staffName: string;
  date: string;
  time: string;
  durationMins: number;
  gracePeriodMins: number;
  status: BookingStatus;
  notes?: string;
}

export interface Sale {
  id: string;
  branchId: string;
  customerId: string;
  customerName: string;
  staffId: string;
  staffName: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  voucher: number;
  total: number;
  paymentMethod: PaymentMethod;
  commission: number;
  createdAt: string;
  receiptNo: string;
}

export interface SaleItem {
  id: string;
  type: "service" | "product";
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface CommissionRule {
  id: string;
  name: string;
  type: CommissionType;
  value: number;
  appliesTo: "all" | "service" | "product";
  serviceId?: string;
  productId?: string;
  staffId?: string;
  active: boolean;
}

export interface MembershipPlan {
  id: string;
  name: string;
  tier: "silver" | "gold" | "platinum";
  price: number;
  discountPercent: number;
  benefits: string[];
  members: number;
}

export interface DashboardStat {
  label: string;
  value: string;
  change: string;
  trend: "up" | "down" | "neutral";
}

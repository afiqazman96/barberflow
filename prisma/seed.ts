/**
 * Development seed — mirrors the Fade House demo tenant from
 * `src/lib/mock/data.ts` so the API can be built against the same fixtures the
 * prototype UI was validated on.
 *
 * IDs are set explicitly (rather than left to cuid()) to match the mock data,
 * so screens still wired to mock IDs keep working during the swap to real APIs.
 *
 * Idempotent: every write is an upsert, so `npm run db:seed` can be re-run.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { createClient } from "@supabase/supabase-js";

import { PrismaClient } from "../src/generated/prisma/client.js";
import {
  BranchStatus,
  CommissionScope,
  CommissionType,
  FeatureKey,
  MembershipTier,
  StaffRole,
  StaffStatus,
  TenantStatus,
} from "../src/generated/prisma/enums.js";

const prisma = new PrismaClient({
  // Prefer the direct connection: seeding is a long-lived single session, which
  // is exactly what the transaction pooler is bad at.
  adapter: new PrismaPg({
    connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  }),
});

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set — seeding needs it to create demo logins.`);
  }
  return value;
}

/**
 * Demo accounts live in Supabase Auth, not in our tables, so the seed has to
 * provision them through the admin API. Kept idempotent like the rest of the
 * seed: existing users have their password reset rather than being recreated.
 */
const supabaseAdmin = createClient(
  requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
  requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function existingAuthUsersByEmail(): Promise<Map<string, string>> {
  const byEmail = new Map<string, string>();
  // The demo set is tiny; one page is plenty, but page anyway so a project
  // with other users in it still resolves ours.
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    for (const user of data.users) {
      if (user.email) byEmail.set(user.email.toLowerCase(), user.id);
    }
    if (data.users.length < 200) break;
  }
  return byEmail;
}

/** Returns the `auth.users.id` for a demo account, creating it if absent. */
async function ensureAuthUser(
  existing: Map<string, string>,
  email: string,
  password: string,
): Promise<string> {
  const key = email.toLowerCase();
  const existingId = existing.get(key);

  if (existingId) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(existingId, {
      password,
    });
    if (error) throw error;
    return existingId;
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: key,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw error ?? new Error(`Could not create auth user for ${email}`);
  }
  existing.set(key, data.user.id);
  return data.user.id;
}

/** Every demo account shares this password. Dev fixtures only. */
const DEMO_PASSWORD = "demo1234";

const ALL_FEATURES = Object.values(FeatureKey);
const GROWTH_FEATURES: FeatureKey[] = [
  FeatureKey.QUEUE,
  FeatureKey.BOOKING,
  FeatureKey.POS,
  FeatureKey.COMMISSION,
  FeatureKey.INVENTORY,
  FeatureKey.MEMBERSHIP,
  FeatureKey.ANALYTICS,
];
const STARTER_FEATURES: FeatureKey[] = [
  FeatureKey.QUEUE,
  FeatureKey.BOOKING,
  FeatureKey.POS,
];

async function seedPackages(): Promise<void> {
  const packages = [
    {
      id: "pkg1",
      name: "Starter",
      slug: "starter",
      price: 199,
      yearlyPrice: 1990,
      maxBranches: 1,
      maxStaff: 5,
      trialDays: 14,
      popular: false,
      features: ["Queue & Booking", "POS", "Basic Reports", "1 Branch"],
      enabled: STARTER_FEATURES,
    },
    {
      id: "pkg2",
      name: "Growth",
      slug: "growth",
      price: 449,
      yearlyPrice: 4490,
      maxBranches: 5,
      maxStaff: 25,
      trialDays: 14,
      popular: true,
      features: [
        "Everything in Starter",
        "Commission Engine",
        "Multi-branch",
        "Inventory",
        "Membership",
        "Advanced Analytics",
      ],
      enabled: GROWTH_FEATURES,
    },
    {
      id: "pkg3",
      name: "Enterprise",
      slug: "enterprise",
      price: 999,
      yearlyPrice: 9990,
      maxBranches: 50,
      maxStaff: 200,
      trialDays: 30,
      popular: false,
      features: [
        "Everything in Growth",
        "Custom Features",
        "Dedicated Support",
        "API Access",
        "White Label",
        "SLA 99.9%",
      ],
      enabled: ALL_FEATURES,
    },
  ];

  for (const { enabled, ...pkg } of packages) {
    await prisma.package.upsert({
      where: { id: pkg.id },
      update: pkg,
      create: pkg,
    });

    // Write the full matrix, not just the enabled rows, so Super Admin sees
    // every feature as an explicit on/off toggle.
    for (const feature of ALL_FEATURES) {
      const flag = { enabled: enabled.includes(feature) };
      await prisma.packageFeature.upsert({
        where: { packageId_feature: { packageId: pkg.id, feature } },
        update: flag,
        create: { packageId: pkg.id, feature, ...flag },
      });
    }
  }
}

async function seedPlatformAdmin(
  authUsers: Map<string, string>,
): Promise<void> {
  const email = "admin@barberflow.io";
  const authUserId = await ensureAuthUser(authUsers, email, DEMO_PASSWORD);

  await prisma.platformAdmin.upsert({
    where: { email },
    update: { name: "Platform Admin", authUserId },
    create: { email, name: "Platform Admin", authUserId },
  });
}

async function seedTenant(authUsers: Map<string, string>): Promise<void> {
  const tenantId = "t1";

  await prisma.tenant.upsert({
    where: { id: tenantId },
    update: {},
    create: {
      id: tenantId,
      name: "Fade House",
      slug: "fade-house",
      packageId: "pkg2",
      status: TenantStatus.ACTIVE,
      mrr: 449,
      ownerName: "Rizal Rahman",
      ownerEmail: "rizal@fadehouse.my",
      settings: {
        create: {
          phone: "+60 3-2141 8890",
          email: "hello@fadehouse.my",
          address: "88 Jalan Bukit Bintang, Lot 12, Kuala Lumpur",
          taxId: "MY-SST-2024-8891",
        },
      },
    },
  });

  const branches = [
    {
      id: "b1",
      name: "Fade House KL",
      address: "88 Jalan Bukit Bintang, Lot 12",
      city: "Kuala Lumpur",
      phone: "+60 3-2141 8890",
      openHours: "10:00 – 22:00",
    },
    {
      id: "b2",
      name: "Fade House Shah Alam",
      address: "Seksyen 13, Plaza Alam Sentral",
      city: "Shah Alam",
      phone: "+60 3-5523 4411",
      openHours: "11:00 – 21:00",
    },
  ];

  for (const branch of branches) {
    await prisma.branch.upsert({
      where: { id: branch.id },
      update: branch,
      create: { ...branch, tenantId, status: BranchStatus.OPEN },
    });
  }

  // Chairs must exist before staff, since Staff.chairId points at them.
  for (const number of [1, 2, 3]) {
    const chair = {
      id: `ch${number}`,
      branchId: "b1",
      number,
      label: `Chair ${number}`,
    };
    await prisma.chair.upsert({
      where: { id: chair.id },
      update: chair,
      create: chair,
    });
  }

  const staff = [
    {
      id: "s0",
      name: "Rizal Rahman",
      email: "rizal@fadehouse.my",
      phone: "+60 12-300 1001",
      role: StaffRole.OWNER,
      status: StaffStatus.AVAILABLE,
      specialty: "Operations",
      // Owners span every branch under the tenant.
      branchId: null as string | null,
      chairId: null as string | null,
      rating: 5,
      monthlyTarget: 100000,
    },
    {
      id: "c1",
      name: "Siti Nurhaliza",
      email: "siti@fadehouse.my",
      phone: "+60 12-300 2002",
      role: StaffRole.CASHIER,
      status: StaffStatus.AVAILABLE,
      specialty: "Front Desk",
      branchId: "b1",
      chairId: null,
      rating: 4.9,
      monthlyTarget: null,
    },
    {
      id: "s1",
      name: "Adam Iskandar",
      email: "adam@fadehouse.my",
      phone: "+60 12-111 2233",
      role: StaffRole.BARBER,
      status: StaffStatus.AVAILABLE,
      specialty: "Skin Fade · Beard",
      branchId: "b1",
      chairId: "ch1",
      rating: 4.9,
      monthlyTarget: 15000,
    },
    {
      id: "s2",
      name: "Hafiz Rahman",
      email: "hafiz@fadehouse.my",
      phone: "+60 12-444 5566",
      role: StaffRole.BARBER,
      status: StaffStatus.AVAILABLE,
      specialty: "Classic Cut · Styling",
      branchId: "b1",
      chairId: "ch2",
      rating: 4.8,
      monthlyTarget: 14000,
    },
    {
      id: "s3",
      name: "Amir Zulkifli",
      email: "amir@fadehouse.my",
      phone: "+60 12-777 8899",
      role: StaffRole.BARBER,
      status: StaffStatus.BREAK,
      specialty: "Taper · Color",
      branchId: "b1",
      chairId: "ch3",
      rating: 4.7,
      monthlyTarget: 12000,
    },
  ];

  for (const member of staff) {
    const authUserId = await ensureAuthUser(
      authUsers,
      member.email,
      DEMO_PASSWORD,
    );

    await prisma.staff.upsert({
      where: { id: member.id },
      update: {
        name: member.name,
        phone: member.phone,
        role: member.role,
        authUserId,
      },
      create: { ...member, tenantId, authUserId },
    });
  }

  const services = [
    { id: "sv1", name: "Signature Fade", category: "Haircut", durationMins: 45, price: 45, membershipPrice: 38, popular: true },
    { id: "sv2", name: "Classic Haircut", category: "Haircut", durationMins: 40, price: 38, membershipPrice: 32, popular: true },
    { id: "sv3", name: "Beard Trim & Shape", category: "Beard", durationMins: 25, price: 28, membershipPrice: 22, popular: false },
    { id: "sv4", name: "Hot Towel Shave", category: "Beard", durationMins: 35, price: 42, membershipPrice: 35, popular: false },
    { id: "sv5", name: "Hair + Beard Combo", category: "Combo", durationMins: 60, price: 65, membershipPrice: 55, popular: true },
    { id: "sv6", name: "Kids Cut", category: "Haircut", durationMins: 30, price: 28, membershipPrice: 24, popular: false },
    { id: "sv7", name: "Hair Color", category: "Color", durationMins: 90, price: 120, membershipPrice: 99, popular: false },
    { id: "sv8", name: "Scalp Treatment", category: "Treatment", durationMins: 40, price: 55, membershipPrice: 45, popular: false },
  ];

  for (const service of services) {
    await prisma.service.upsert({
      where: { id: service.id },
      update: service,
      create: { ...service, tenantId },
    });
  }

  const products = [
    { id: "p1", name: "Matte Clay Pomade", category: "Styling", sku: "STY-001", price: 48, stock: 32 },
    { id: "p2", name: "Beard Oil — Cedar", category: "Beard", sku: "BRD-002", price: 55, stock: 18 },
    { id: "p3", name: "Sea Salt Spray", category: "Styling", sku: "STY-003", price: 42, stock: 24 },
    { id: "p4", name: "Shampoo — Daily", category: "Care", sku: "CARE-004", price: 38, stock: 40 },
    { id: "p5", name: "Aftershave Balm", category: "Care", sku: "CARE-005", price: 36, stock: 15 },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: product,
      create: { ...product, tenantId },
    });
  }

  const plans = [
    {
      id: "m1",
      name: "Silver",
      tier: MembershipTier.SILVER,
      price: 49,
      discountPercent: 10,
      benefits: ["10% off services", "Priority SMS"],
    },
    {
      id: "m2",
      name: "Gold",
      tier: MembershipTier.GOLD,
      price: 89,
      discountPercent: 15,
      benefits: ["15% off services", "Free beard trim/mo", "Priority queue"],
    },
    {
      id: "m3",
      name: "Platinum",
      tier: MembershipTier.PLATINUM,
      price: 149,
      discountPercent: 20,
      benefits: ["20% off all", "2 free cuts/mo", "Skip queue", "Product discounts"],
    },
  ];

  for (const plan of plans) {
    await prisma.membershipPlan.upsert({
      where: { id: plan.id },
      update: plan,
      create: { ...plan, tenantId },
    });
  }

  const commissionRules = [
    { id: "cr1", name: "Service Default", type: CommissionType.PERCENTAGE, value: 30, appliesTo: CommissionScope.SERVICE },
    { id: "cr2", name: "Product Default", type: CommissionType.PERCENTAGE, value: 15, appliesTo: CommissionScope.PRODUCT },
    { id: "cr3", name: "Signature Fade Boost", type: CommissionType.SERVICE_BASED, value: 15, appliesTo: CommissionScope.SERVICE, serviceId: "sv1" },
    { id: "cr4", name: "Adam Override", type: CommissionType.PERCENTAGE, value: 35, appliesTo: CommissionScope.ALL, staffId: "s1" },
  ];

  for (const rule of commissionRules) {
    await prisma.commissionRule.upsert({
      where: { id: rule.id },
      update: rule,
      create: { ...rule, tenantId },
    });
  }

  const customers = [
    { id: "cu1", name: "Faizal Omar", phone: "+60 12-901 4412", email: "faizal@example.my", membership: MembershipTier.GOLD, membershipPlanId: "m2", preferredStaffId: "s1" },
    { id: "cu2", name: "Daniel Tan", phone: "+60 16-220 7781", email: "daniel@example.my", membership: MembershipTier.SILVER, membershipPlanId: "m1", preferredStaffId: null },
    { id: "cu3", name: "Haziq Aziz", phone: "+60 11-3355 9021", email: null, membership: MembershipTier.NONE, membershipPlanId: null, preferredStaffId: "s2" },
  ];

  for (const customer of customers) {
    await prisma.customer.upsert({
      where: { id: customer.id },
      update: { name: customer.name },
      create: { ...customer, tenantId },
    });
  }
}

async function main(): Promise<void> {
  const authUsers = await existingAuthUsersByEmail();

  await seedPackages();
  await seedPlatformAdmin(authUsers);
  await seedTenant(authUsers);

  console.log("Seeded packages, platform admin, and the Fade House tenant.");
  console.log(`Shop logins: rizal@fadehouse.my (owner), siti@fadehouse.my (cashier), adam@fadehouse.my (barber)`);
  console.log(`Platform login: admin@barberflow.io`);
  console.log(`Password for all demo accounts: ${DEMO_PASSWORD}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

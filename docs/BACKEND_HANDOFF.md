# BarberFlow — Backend Handoff Specification

**Version:** 1.0  
**Date:** 1 August 2026  
**Status:** Frontend PWA prototype complete — ready for backend implementation  
**Audience:** Backend engineers / technical leads  

---

## 1. Purpose

This document describes the product behaviour validated by the BarberFlow frontend prototype so the backend can be implemented without rediscovering business flows.

The frontend is a **Next.js Progressive Web App** using mock data and client-side state (Zustand). It proves:

- Multi-tenant SaaS structure  
- Role-based workflows  
- Customer QR walk-in & booking  
- Staff / cashier / owner operations  
- Platform (Super Admin) subscription management  

**Backend must become the source of truth.** Frontend limits and validations are UX only; all critical rules must be enforced on the API.

---

## 2. Product Summary

**BarberFlow** is a multi-tenant SaaS for barber shops and salons.

| Layer | Responsibility |
|--------|----------------|
| **Platform (Super Admin)** | Tenants, packages, feature flags, billing overview, support |
| **Tenant (Shop brand)** | e.g. Fade House — one company, many branches |
| **Branch** | Physical shop — one queue, chairs, staff, hours |
| **Users** | Owner, Cashier, Barber (Staff), Customer (no login) |

### Entry points

| Who | Entry |
|-----|--------|
| Shop team (Owner / Cashier / Staff) | `/` — email + password |
| Super Admin | `/platform` — separate console (not shown on shop UI) |
| Barber shop owner (new signup) | `/pricing` — choose plan → start trial |
| Customer | Scan branch QR → `/join/{branchId}` → join queue |
| Lobby TV | `/display` |

---

## 3. Technology Expectations (Suggested)

Frontend already uses TypeScript. Suggested backend stack (flexible):

- API: REST or tRPC / GraphQL (REST assumed below)  
- Auth: JWT / session + hashed passwords (bcrypt/argon2)  
- DB: PostgreSQL (multi-tenant)  
- Optional: Redis for live queue pub/sub  
- Push / offline: FCM + background sync (later phase)  

Deploy frontend on Vercel is fine; API can be separate service.

---

## 4. Roles & Permissions

### 4.1 Super Admin (platform)

- Manage tenants, packages, feature matrix, subscriptions, support tickets  
- **Must not** appear on shop-facing login UI  
- Access via dedicated host/path (prototype: `/platform`)

### 4.2 Owner (tenant)

Access **all branches** under their tenant:

- Dashboard, Queue, Appointments, POS, Customers, Staff, Commission, Inventory, Reports, Settings, Billing  

Cannot manage platform tenants/packages.

### 4.3 Cashier

Primary devices: tablet / desktop  

- Dashboard, Walk-in registration, Queue monitor, Appointments, POS, Payment, Customers  

**Cannot:** commission settings, system/subscription settings, staff password admin (unless product decides otherwise).

### 4.4 Staff (Barber)

Primary device: phone — each barber has own login  

- Dashboard (shift), Current service, Commission, History, Profile (change password)  

### 4.5 Customer

No authentication. Identified by **phone OR email** (+ name) when joining queue / booking.

---

## 5. Domain Model (Core Entities)

Align API/DB with these concepts (field names may be adapted).

### 5.1 Tenant

| Field | Notes |
|--------|--------|
| `id`, `name`, `slug` | Unique slug for URLs |
| `packageId` | FK → Package |
| `status` | `active` \| `trial` \| `suspended` |
| `billing` | `monthly` \| `yearly` |
| `mrr` | Derived from package when active; `0` on trial/suspended |
| `ownerName`, `ownerEmail` | Primary contact |
| `trialEndsAt` | Optional |
| `createdAt` | |

### 5.2 Package

| Field | Notes |
|--------|--------|
| `name`, `price`, `yearlyPrice` | |
| `maxBranches`, `maxStaff` | Hard limits — **enforce on API** |
| `trialDays` | Default trial length |
| `features[]` | Marketing bullets |
| Feature flags | Per-package matrix (see §9) |

### 5.3 Branch

Belongs to `tenantId`. Fields: name, address, city, phone, status (`open`/`closed`/`busy`), open hours, chair count, queue metrics.

**Each branch has one walk-in queue.**

### 5.4 Chair

Belongs to `branchId`. Assigned to at most one staff (`staffId` nullable). Owner can reassign anytime.

### 5.5 Staff (User)

| Field | Notes |
|--------|--------|
| `branchId`, `role` | `owner` \| `cashier` \| `barber` |
| `email`, `passwordHash` | Login identity |
| `active` | Soft disable — reject login if false |
| `mustChangePassword` | Force change after owner sets temp password |
| `status` | `off-duty` \| `available` \| `busy` \| `break` |
| `chairId` | Optional |
| Sales / commission aggregates | Prefer computed from sales, or cached daily |

**Login mapping:** `barber` → staff app; `owner` / `cashier` → respective apps.

### 5.6 Customer

Phone and/or email; membership tier; visit history; preferred barber optional. Scope by tenant (and optionally branch).

### 5.7 Queue ticket

| Field | Notes |
|--------|--------|
| `number` | e.g. `A021` — unique per branch per day recommended |
| `branchId`, customer contact, services | |
| `preferredStaffId` / `assignedStaffId` | Null preferred = “Any Barber” |
| `chairId` | When in service |
| `status` | `waiting` \| `called` \| `in-service` \| `awaiting-payment` \| `completed` \| `no-show` \| `cancelled` |
| `source` | `qr` \| `cashier` \| `booking` |
| `estimatedWaitMins` | |

### 5.8 Booking

Date, time, duration, services, staff (or any), `gracePeriodMins` (default **10**), status: `confirmed` \| `checked-in` \| `in-service` \| `completed` \| `no-show` \| `cancelled`.

### 5.9 Sale / Sale line / Payment

Services and products, qty, discount, voucher, membership price, payment method (`cash` \| `card` \| `qr`), receipt number, **commission amount**.

### 5.10 Commission rule

Configurable (no hardcoding in production):

- Types: `fixed` \| `percentage` \| `service-based` \| `product-based`  
- Scope: all / service / product; optional staff override  

### 5.11 Catalog

Services (duration, price, membership price), Products (SKU, stock, price), Membership plans.

### 5.12 Support ticket (platform)

Linked to `tenantId`; priority; status `open` \| `in-progress` \| `resolved`.

---

## 6. End-to-End Business Flows

### 6.1 Owner subscribes (SaaS)

1. Owner opens **Pricing**, selects package (monthly/yearly).  
2. Submits business name + owner email → create **Tenant** with `status = trial`, `mrr = 0`, `trialEndsAt = now + trialDays`.  
3. Super Admin sees tenant; can convert trial → active (start charging MRR from package price), change plan, suspend/activate.  

**API must:** create tenant + owner user, apply package limits & features.

### 6.2 Staff provisioning (Owner)

1. Owner adds staff: name, email, role, branch, **password** (temp), optional “must change password”.  
2. Staff signs in at `/` with email + password.  
3. If `mustChangePassword`, force password change before normal use.  
4. Owner can reset password and disable account (`active = false`).  

**API must:** hash passwords; never return plaintext password after create (return once on create only if needed).

### 6.3 Customer QR walk-in

1. Each branch has a unique QR → `/join/{branchId}`.  
2. Customer lands on join queue form.  
3. **Required:** name + **phone OR email**.  
4. Select service(s), Any Barber or Preferred Barber.  
5. System issues queue number; customer tracks status.  

Same queue is created if Cashier registers walk-in manually (`source = cashier`).

### 6.4 Booking

1. Customer selects branch → date → time → service → Any/Preferred barber.  
2. Booking confirmed with grace period (default 10 minutes).  

**No-show rule (product requirement):**

```
IF now > bookingTime + gracePeriod
AND assigned barber status = Available
AND barber has NOT pressed Start Service
THEN mark booking No-Show and release slot
```

**If assigned barber status = Busy → do NOT cancel** — keep customer waiting.

Prototype currently allows **manual** no-show; backend should implement **scheduled job / cron** for auto no-show.

### 6.5 Queue assignment

- **One queue per branch.**  
- Preferred barber → wait until that barber is `available`.  
- Any Barber → assign to next available barber.  

### 6.6 Staff shift lifecycle

```
Login → Start Shift (pick chair) → Available
  → Receive customer → Start Service → Busy (Busy is NOT manually selectable)
  → Complete Service → awaiting-payment
  → Payment completed → commission calculated → Available
  → End Shift → Off Duty
```

Break is manual. Available returns automatically after successful payment.

### 6.7 Cashier / POS

1. Walk-in or select customer awaiting payment.  
2. POS: services, products, qty, discount, voucher, membership price.  
3. Pay: cash / card / QR.  
4. On success: create Sale, compute commission, mark queue completed, set barber Available, issue receipt.  

### 6.8 Commission

- Calculated **only after successful payment**.  
- Driven by configurable rules (owner commission module).  
- Staff override percentage takes priority when configured.

---

## 7. Suggested API Surface (REST sketch)

Group by domain. All shop APIs require auth + **tenant isolation**. Platform APIs require Super Admin.

### Auth

- `POST /auth/login` — email/password → tokens + role + tenantId/branchId  
- `POST /auth/platform/login` — Super Admin only  
- `POST /auth/change-password`  
- `POST /auth/logout`  

### Platform

- `GET/POST /platform/tenants`  
- `PATCH /platform/tenants/:id`  
- `POST /platform/tenants/:id/convert-trial`  
- `POST /platform/tenants/:id/suspend|activate`  
- `POST /platform/tenants/:id/change-plan`  
- `GET/POST/PATCH /platform/packages`  
- `GET/PATCH /platform/feature-matrix`  
- `GET/POST/PATCH /platform/support-tickets`  
- `GET /platform/metrics` — MRR, trials, open tickets  

### Public / marketing

- `GET /packages` — public pricing  
- `POST /signup` — create trial tenant + owner  

### Tenant (Owner / staff scoped)

- Branches, chairs, staff CRUD  
- Services, products, commission rules, membership, settings  
- Customers search/list  
- Bookings CRUD + check-in → create queue ticket  
- Queue CRUD + status transitions  
- POS checkout `POST /sales` (atomic payment + commission + queue complete)  
- Reports aggregations  
- Billing: current subscription / usage vs limits  

### Customer (public, branch-scoped)

- `GET /branches/:id/public` — shop status, wait, barbers  
- `POST /branches/:id/queue` — join (name + phone|email required)  
- `GET /queue/:id` — tracking  
- `POST /branches/:id/bookings`  

---

## 8. Critical Backend Enforcement Rules

| Rule | Frontend today | Backend must |
|------|----------------|--------------|
| Plan `maxBranches` / `maxStaff` | Display only | Reject create when over limit |
| Feature flags by package | Matrix in Super Admin | Gate modules (e.g. commission, inventory, API) |
| Password storage | Plain text in prototype | Hash only |
| Tenant data isolation | Single demo tenant | Strict `tenantId` on every query |
| Busy status | UI-driven | Only via Start Service |
| Commission | Client calc | Recalculate server-side on payment |
| No-show | Manual | Prefer automated job + grace logic |
| Queue number uniqueness | Client increment | Atomic per branch/day |
| Payment | Mock success | Idempotent payment + sale creation |

---

## 9. Feature Matrix (by package)

Prototype keys:

`queue`, `booking`, `pos`, `commission`, `inventory`, `membership`, `analytics`, `api`, `white-label`

Default intent:

| Feature | Starter | Growth | Enterprise |
|---------|---------|--------|------------|
| Queue / Booking / POS | ✓ | ✓ | ✓ |
| Commission / Inventory / Membership / Analytics | ✗ | ✓ | ✓ |
| API / White-label | ✗ | ✗ | ✓ |

Super Admin can toggle matrix; backend should persist and enforce.

---

## 10. Multi-Device Architecture (per branch example)

- 1× Cashier desktop/tablet  
- N× Barber phones (one login each)  
- Optional TV queue display  
- Customers via QR / mobile web / PWA  

Consider realtime (WebSocket / SSE / Supabase realtime) for:

- Queue updates  
- Staff status  
- “Now serving” TV  

---

## 11. Non-Goals for Backend v1 (OK to defer)

- Full accounting / accounting ledger  
- Real payment gateway settlement (can stub then integrate Stripe/iPay88 later)  
- Push notifications & offline sync (PWA shell ready; needs backend later)  
- White-label theming engine  

---

## 12. Frontend → Backend Integration Notes

| Area | Current | After backend |
|------|---------|----------------|
| `useAppStore` / `usePlatformStore` | Zustand mock | Replace with API clients + React Query / SWR |
| Auth | Client authenticate() | JWT/session; remove password from client state |
| Branch QR URL | `{origin}/join/{branchId}` | Keep same path contract |
| Environment | `localhost:3001` | Vercel frontend + API base URL env |

Keep route structure and DTO shapes close to `src/lib/types.ts` to minimise frontend rework.

---

## 13. Acceptance Criteria for Backend MVP

1. Owner can sign up (trial), convert to paid, and hit plan limits safely.  
2. Owner creates staff with temp password; staff can login and change password.  
3. Customer QR join requires phone or email and appears on cashier/staff queue.  
4. Preferred vs Any Barber assignment works.  
5. Start Service → Busy; payment → Available + commission sale record.  
6. Super Admin can list tenants, change plans, suspend, manage packages/features/support.  
7. All tenant data is isolated; Super Admin is separate from shop UI.  
8. Branch/staff create fails with clear error when over package limits.  

---

## 14. Reference Prototype

- Repo: BarberFlow frontend (this project)  
- Key type definitions: `src/lib/types.ts`  
- Shop state prototype: `src/lib/store/app-store.ts`  
- Platform state prototype: `src/lib/store/platform-store.ts`  
- README: product overview & role entry points  

---

## 15. Open Decisions for Backend Team

1. Single DB with `tenant_id` vs schema-per-tenant.  
2. Queue number format & daily reset policy.  
3. Realtime transport choice.  
4. Payment provider for Malaysia (card / DuitNow QR).  
5. Whether cashiers may reset staff passwords.  
6. Auto no-show job interval and timezone handling per branch.  

---

**Document owner:** Product / Frontend validation  
**Next step:** Backend scaffold (auth + tenants + branches + queue + sales) aligned to this spec, then wire frontend env `NEXT_PUBLIC_API_URL`.

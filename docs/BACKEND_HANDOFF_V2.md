# BarberFlow — Backend Handoff Addendum (POS v2)

**Version:** 2.0 (addendum to `BACKEND_HANDOFF.md` v1.0)
**Date:** 13 September 2026
**Status:** Frontend-only increment, merged to `develop` at `c1c2ecf`. Mock data / Zustand still backs every screen below — nothing here is wired to Prisma yet.
**Audience:** Backend engineers picking up `develop` after this merge
**Scope:** 16 commits, `69ba6de..c1c2ecf` (branches `frontend/prebackend-fixes` → `feature/pos-owner-tools` → `feature/report-export` → `feature/customer-booking-access`)

This does not replace v1 — it only calls out what changed since it, in the same terms (§ numbers below map loosely to the v1 doc's sections). Read v1 first if you haven't.

---

## 1. What shipped in this increment

- **Cash drawer / shift management** — open float, cash in/out, auto-logged cash sales, close with variance, "change shift"; owner-side shift history.
- **POS additions** — barber tips, discount with a reason (audit trail), membership upsell at checkout, commission preview, owner void-sale (reverses commission/stock/cash).
- **Barber now optional** on a product-only sale (no service performed → no commission, sale attributed to "Retail").
- **Owner-configurable service charge + SST**, off by default, with a rate, an "apply to services only vs everything" toggle, and an SST registration number — all under Settings → **Tax & Charges**.
- **Card payment capture** — optional scheme / last-4 / approval-code fields recorded when `paymentMethod = CARD`. This is **not** a payment gateway integration; it's a manual log of what the terminal showed, same trust level as cash counting.
- **Reports restored** — the tabbed Reports & Analytics UI (Overview, POS Sales, Staff, Customers, Services, Products, Commission, Queue, Appointments) with Excel/PDF export, which had been dropped when `develop` rewrote the reports page during the Supabase integration. Pure read/aggregation UI — no new write paths.
- **Customer booking made reachable** — routing/UX only, no data model impact (see §5).

---

## 2. Data model deltas (Prisma)

Everything below is additive. Current `develop` schema already has `Sale`, `SaleItem`, `TenantSettings`, etc. — this lists exactly what's missing against the frontend's `src/lib/types.ts`.

### 2.1 `Sale` — new columns

```prisma
model Sale {
  // ...existing fields unchanged...

  tip               Decimal  @default(0) @db.Decimal(10, 2)
  discountReason    String?

  serviceCharge     Decimal  @default(0) @db.Decimal(10, 2)
  serviceChargeRate Decimal  @default(0) @db.Decimal(5, 2)
  tax               Decimal  @default(0) @db.Decimal(10, 2)
  taxRate           Decimal  @default(0) @db.Decimal(5, 2)

  cardScheme        String?
  cardLast4         String?  @db.Char(4)
  cardApprovalCode  String?

  voidedReason      String?
  voidedAt          DateTime?
  voidedBy          String?   // staffId of the owner who voided it
}
```

Notes:
- `serviceChargeRate` / `taxRate` are **snapshots at sale time** (the owner's rate may change later; historical receipts must keep the rate that was actually charged). Same reasoning as `unitPrice` on `SaleItem` already being snapshotted.
- Card fields are all nullable and only meaningful when `paymentMethod = CARD`. Do not add a NOT NULL constraint tied to payment method — a cashier can leave them blank.
- `voided*` could instead become a separate `SaleVoid` 1:1 table if you'd rather keep `Sale` append-only; the frontend model (`src/lib/types.ts` → `Sale.voided`) doesn't care which shape you pick, only that voided sales are excluded from revenue aggregates unless explicitly asked for (see the reports' "Include voided" checkbox).

### 2.2 New models — cash drawer

Nothing like this exists in the schema yet.

```prisma
model DrawerSession {
  id            String    @id @default(cuid())
  tenantId      String
  branchId      String
  cashierId     String
  openingFloat  Decimal   @db.Decimal(10, 2)
  openedAt      DateTime  @default(now())
  closedAt      DateTime?
  countedAmount Decimal?  @db.Decimal(10, 2)
  closingNote   String?

  tenant     Tenant          @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  branch     Branch          @relation(fields: [branchId], references: [id], onDelete: Cascade)
  cashier    Staff           @relation(fields: [cashierId], references: [id])
  movements  CashMovement[]

  @@index([branchId, openedAt])
  @@map("drawer_sessions")
}

enum CashMovementType {
  SALE
  REFUND
  PAY_IN
  PAY_OUT
}

model CashMovement {
  id       String            @id @default(cuid())
  sessionId String
  type     CashMovementType
  /// Signed: positive adds cash to the drawer, negative removes it.
  amount   Decimal           @db.Decimal(10, 2)
  note     String
  saleId   String?
  at       DateTime          @default(now())

  session DrawerSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  sale    Sale?         @relation(fields: [saleId], references: [id], onDelete: SetNull)

  @@index([sessionId])
  @@map("cash_movements")
}
```

Reference: `src/lib/types.ts` (`DrawerSession`, `CashMovement`), `src/lib/store/app-store.ts` (`openDrawer`, `closeDrawer`, `addCashMovement`, `drawerExpected`).

`drawerExpected(session) = session.openingFloat + sum(session.movements.amount)`. Only **one open `DrawerSession` per (branchId, cashierId)** should be allowed at a time — the frontend assumes this and doesn't handle two open sessions gracefully.

### 2.3 `TenantSettings` — tax config

```prisma
model TenantSettings {
  // ...existing fields unchanged...

  serviceChargeEnabled Boolean @default(false)
  serviceChargeRate    Decimal @default(10) @db.Decimal(5, 2)
  sstEnabled           Boolean @default(false)
  sstRate              Decimal @default(8) @db.Decimal(5, 2)
  sstRegNo             String?
  /// "SERVICES" (default) excludes retail products from the charge base —
  /// the Malaysian norm, since products already carry sales tax upstream.
  chargeApplyTo        ChargeScope @default(SERVICES)
}

enum ChargeScope {
  SERVICES
  ALL
}
```

Reference: `src/lib/types.ts` (`TaxConfig`), `src/app/owner/settings/page.tsx` ("Tax & Charges" tab), `src/lib/pos-pricing.ts`.

**The exact formula backend must replicate at checkout** (client math must never be trusted — same rule as commission in v1 §8):

```
goodsTotal   = max(0, subtotal - discount)
chargeBase   = chargeApplyTo == ALL ? goodsTotal : max(0, serviceLinesSubtotal - discount)
serviceCharge = serviceChargeEnabled ? round(chargeBase * serviceChargeRate / 100) : 0
tax          = sstEnabled ? round((chargeBase + serviceCharge) * sstRate / 100) : 0
total        = goodsTotal + serviceCharge + tax + tip
```

Commission is computed on `goodsTotal` only — never on tax, service charge or tip. `src/lib/pos-pricing.ts::computeCharges()` is the reference implementation; port it verbatim rather than re-deriving it.

### 2.4 No schema change needed

- **Reports** (§1) are pure aggregation over existing tables. The existing indexes (`Sale @@index([branchId, paidAt])`, `@@index([staffId, paidAt])`) already cover the date-range + per-staff queries the report tabs need. If a "Products & Inventory" report query turns out slow, an index on `SaleItem(refId)` would help — not required for correctness.
- **Customer booking discoverability** (§1) — the QR landing page, bottom nav, and booking wizard changes are routing/UX only. No new fields, no new tables.

---

## 3. New/changed API surface

Extends v1 §7.

- `POST /branches/:id/drawer/open` — `{ openingFloat }` → creates a `DrawerSession`. Reject if the cashier already has one open for this branch.
- `POST /drawer/:sessionId/movements` — `{ type, amount, note, saleId? }`. `type = SALE` movements are created server-side by the checkout endpoint, not called directly by the client.
- `POST /drawer/:sessionId/close` — `{ countedAmount, closingNote? }`.
- `POST /sales/:id/void` — `{ reason }`, owner-only (see §4). Reverses staff commission/sales aggregates, restocks products, and — if the original payment was cash and its drawer session is still open — logs a `REFUND` cash movement.
- `POST /sales` (checkout, existing per v1) — request body needs `tip`, `discountReason?`, and `card?: { scheme?, last4?, approvalCode? }` added; response/stored row needs `serviceCharge`, `tax` computed server-side per §2.3, never accepted from the client.

## 4. Business rules to enforce server-side

Extends v1 §8's table:

| Rule | Frontend today | Backend must |
|------|----------------|--------------|
| Service charge / SST amounts | Computed client-side from `TenantSettings` | Recompute server-side at checkout from the tenant's stored config; reject/ignore any tax figures sent by the client |
| Barber required on sale | Only enforced if the cart has a service line; optional for product-only | Same rule server-side — a sale with zero service lines may have `staffId = null` |
| Void authorization | UI only shows "Void sale" to `owner` role | Enforce role check server-side; a cashier hitting the endpoint directly must be rejected |
| One open drawer per cashier | Assumed, not enforced (no real backend yet) | Reject opening a second session while one is open for that (branch, cashier) |
| Card fields | Free text, unvalidated | Keep unvalidated — this is a manual log, not a payment integration. Do **not** treat `last4`/`approvalCode` as sensitive card data requiring PCI handling (no PAN, no CVV, no expiry ever collected), but still scope them tenant-side like the rest of the sale |

## 5. Frontend reference map

| Concept | File |
|---|---|
| Sale/TaxConfig/CashMovement/DrawerSession shapes | `src/lib/types.ts` |
| Checkout math (service charge / SST / total) | `src/lib/pos-pricing.ts` |
| Drawer open/close/movement actions, void logic, checkout flow | `src/lib/store/app-store.ts` (`openDrawer`, `closeDrawer`, `addCashMovement`, `drawerExpected`, `completePayment`, `voidSale`) |
| Tax & Charges settings UI | `src/app/owner/settings/page.tsx` (`"tax"` tab) |
| Cash drawer UI | `src/app/cashier/drawer/page.tsx`, `src/app/owner/cash-drawer/page.tsx` |
| Report shapes (columns/rows/summary per tab) | `src/lib/reports/builders.ts` |
| Report export (client-side, no backend involvement) | `src/lib/reports/export.ts` |

## 6. Non-goals / explicitly out of scope for this increment

- No real payment gateway. Card capture is a manual log (§4).
- No accounting export beyond the existing Excel/PDF report download (client-generated, not a backend job).
- `xlsx` / `jspdf` / `jspdf-autotable` are frontend-only `package.json` dependencies — no backend action needed. (`xlsx@0.18.5` carries two unfixed advisories in its *parse* path; this app only writes files with it, so the practical exposure is low, but flagging it since `npm audit` will show it.)

## 7. Open questions for backend team

1. Service charge / SST config in §2.3 is modeled per-**tenant** (`TenantSettings`). If a tenant ever needs different rates per branch, that's a bigger change — confirm tenant-level is acceptable for now (matches what the owner UI exposes today: one Settings page, no per-branch override).
2. Should `DrawerSession` cash movements of type `SALE` be written in the same DB transaction as the `Sale` insert, or eventually-consistent via an event? Frontend assumes atomic (the cash total is always in sync with sales).
3. Void: frontend reverses staff aggregates and restocks by matching `SaleItem.name` against current product names (mock-data shortcut). Backend should match by `SaleItem.refId` → `Product.id` instead — more correct, no frontend change needed.

---

**Document owner:** Frontend validation (this increment)
**Predecessor:** `docs/BACKEND_HANDOFF.md` v1.0 (1 Aug 2026) — domain model, roles, and MVP flows there are unchanged and still authoritative except where this addendum overrides them.

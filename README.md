# BarberFlow

Premium SaaS Barber & Salon Management System — **Frontend PWA Prototype (v1.0)**

Validates business flow, UI/UX, customer journey, staff/cashier/owner workflows, and responsive layouts before backend development.

## Stack

- Next.js 16 (App Router) · TypeScript · Tailwind CSS v4
- Framer Motion · Lucide · Recharts · Zustand
- PostgreSQL 17 · Prisma 7 (ORM)
- Progressive Web App (manifest + service worker)

## Quick Start

```bash
npm install
cp .env.example .env     # fill in from your Supabase project — see Database below
npm run db:deploy        # apply migrations to Supabase
npm run db:seed          # load the Fade House demo tenant + its Supabase Auth logins
npm run dev
```

Open **[http://localhost:3001](http://localhost:3001)** (port 3001 by default).

If an old tab on port 3000 shows a blank / looping page, that tab still has a broken service worker. Use port **3001**, or open [http://localhost:3001/clear-sw.html](http://localhost:3001/clear-sw.html) once, then hard-refresh.

## Roles & Routes

| Role | Primary device | Entry |
|------|----------------|--------|
| Customer | Mobile | Shop QR → `/join/{branchId}` |
| Staff / Barber | Phone | `/` → Staff tab |
| Cashier | Tablet / Desktop | `/` → Cashier tab |
| Owner | Desktop | `/` → Owner tab |
| Super Admin | Desktop | `/platform` (hidden — not on shop UI) |
| Queue TV Display | TV / Large screen | `/display` |

Authentication is **Supabase Auth** (email + password). Supabase owns credentials;
role, `tenantId` and `branchId` come from our own `staff` row, linked by
`authUserId`. See [`src/lib/auth/session.ts`](src/lib/auth/session.ts).

## Demo Tenant

**Fade House** · KL Branch · 3 barbers (Adam, Hafiz, Amir) · 1 cashier · 80 customers · live queue & bookings.

## Database

PostgreSQL is hosted by **Supabase**. Two connection strings, and they are not interchangeable:

| Variable | Port | Used by | Why |
|----------|------|---------|-----|
| `DATABASE_URL` | 6543 (transaction pooler) | App runtime — [`src/lib/prisma.ts`](src/lib/prisma.ts) | Serverless functions churn connections; the pooler absorbs that |
| `DIRECT_URL` | 5432 (session pooler) | Prisma CLI — `prisma.config.ts` | Transaction mode cannot run DDL or hold the advisory locks migrations need |

Both go through the **pooler**, in different modes. Do not use
`db.<project-ref>.supabase.co`: it is IPv6-only and fails to resolve on
networks without IPv6 egress. Setting up a fresh project?
See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

`docker-compose.yml` and the `db:up` / `db:down` scripts are leftovers from the
local-Postgres setup and are no longer part of the workflow.

| Script | Purpose |
|--------|---------|
| `npm run db:migrate` | Create + apply a migration from schema changes |
| `npm run db:deploy` | Apply existing migrations (CI / production) |
| `npm run db:generate` | Regenerate Prisma Client (also runs on `postinstall`) |
| `npm run db:seed` | Load demo data — idempotent, safe to re-run |
| `npm run db:studio` | Browse data in Prisma Studio |

- Schema: [`prisma/schema.prisma`](prisma/schema.prisma) — models the full domain in [`docs/BACKEND_HANDOFF.md`](docs/BACKEND_HANDOFF.md) §5
- Connection URL lives in `prisma.config.ts` (Prisma 7 moved it out of `schema.prisma`)
- Supabase clients: [`src/lib/supabase/`](src/lib/supabase) — `client` (browser), `server` (RSC/actions), `admin` (service role, server-only)
- Session refresh runs in [`src/proxy.ts`](src/proxy.ts) — Next.js 16 renamed Middleware to Proxy
- Client singleton: [`src/lib/prisma.ts`](src/lib/prisma.ts) — import `prisma` from there, never construct `PrismaClient` directly
- Generated client: `src/generated/prisma` (git-ignored; regenerate after schema changes)

### Seeded logins

Password for every demo account is `demo1234`.

| Role | Email |
|------|-------|
| Owner | `rizal@fadehouse.my` |
| Cashier | `siti@fadehouse.my` |
| Barber | `adam@fadehouse.my` |
| Super Admin | `admin@barberflow.io` |

### Schema notes

- Every tenant-owned table carries `tenantId`. The database cannot enforce isolation — **every query must filter on it**.
- Money uses `Decimal(10,2)`, which Prisma returns as a `Decimal` object and serializes to JSON as a **string**. Convert at the API boundary.
- `QueueCounter` backs atomic per-branch, per-day queue numbers; increment it in the same transaction as the ticket.
- Line items on tickets, bookings, and sales snapshot name/price/duration so later catalog edits don't rewrite history.
- Staff/booking/sale aggregates (`todaySales`, `visits`, `totalSpent`) are intentionally **not** columns — derive them from `sales`.

## Architecture Notes

- Mock data: `src/lib/mock/data.ts`
- Client state / workflows: `src/lib/store/app-store.ts`
- Domain types: `src/lib/types.ts`
- Shared UI: `src/components/ui`, layouts, domain cards
- Role apps under `src/app/{customer,staff,cashier,owner,super-admin}`

Structured for later API swap: replace store actions with fetch/mutations without rewriting pages.

## PWA

- `public/manifest.webmanifest`
- `public/sw.js` (installable; offline shell ready for future sync/push)

Install from browser “Add to Home Screen” / Install app on supported devices.

## Deployment

Standing the app up on your own Supabase project and hosting it on Vercel:
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Backend handoff

Full English specification for backend implementation: [`docs/BACKEND_HANDOFF.md`](docs/BACKEND_HANDOFF.md)

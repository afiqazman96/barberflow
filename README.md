# BarberFlow

Premium SaaS Barber & Salon Management System — **Frontend PWA Prototype (v1.0)**

Validates business flow, UI/UX, customer journey, staff/cashier/owner workflows, and responsive layouts before backend development.

## Stack

- Next.js 16 (App Router) · TypeScript · Tailwind CSS v4
- Framer Motion · Lucide · Recharts · Zustand
- Progressive Web App (manifest + service worker)

## Quick Start

```bash
npm install
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

Demo login accepts any password. No real authentication or API.

## Demo Tenant

**Fade House** · KL Branch · 3 barbers (Adam, Hafiz, Amir) · 1 cashier · 80 customers · live queue & bookings.

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

## Backend handoff

Full English specification for backend implementation: [`docs/BACKEND_HANDOFF.md`](docs/BACKEND_HANDOFF.md)

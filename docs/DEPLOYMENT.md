# Deploying BarberFlow to a new Supabase project + Vercel

Written for someone standing up their **own** Supabase account and hosting the
app on Vercel. Nothing here reuses the original developer's project.

Budget about an hour. Most of it is waiting for a Supabase project to
provision; the steps themselves are short.

---

## 0. What you need

- A Supabase account (free tier is enough) and a Vercel account
- Node 20+ and a clone of this repo
- `npm install` run once — it triggers `prisma generate` via `postinstall`

---

## 1. Create the Supabase project

1. **New project.** Pick a region close to your users. Save the database
   password Supabase generates — it appears once, and you need it in step 2.
2. Wait for provisioning to finish before continuing. A project that is still
   starting up will refuse connections in confusing ways.

### Collect the two connection strings

Dashboard → **Project Settings → Database → Connection string**.

You need the **pooler** strings, in two different modes:

| Env var | Mode | Port | Used by |
|---|---|---|---|
| `DATABASE_URL` | Transaction | `6543` | App runtime (`src/lib/prisma.ts`) |
| `DIRECT_URL` | Session | `5432` | Prisma CLI only (`prisma.config.ts`) |

Both look like:

```
postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:<port>/postgres
```

> **Do not use `db.<project-ref>.supabase.co`.** Supabase's docs still show it
> as the "direct" connection, but it publishes only an **AAAA (IPv6) record**.
> On any network without IPv6 egress — most home ISPs, many CI runners — it
> fails DNS resolution outright with `ENOTFOUND`. The pooler is dual-stack.
> Session mode on port 5432 does everything the direct connection does for our
> purposes: it runs DDL and holds the advisory lock `prisma migrate` needs.

Copy the host verbatim. The region prefix (`aws-0-` vs `aws-1-`, and the region
itself) differs per project and cannot be guessed from the project ref.

If your password contains `@ : / ? # [ ]` or a space, percent-encode it
(`p@ss` → `p%40ss`).

### Collect the two API keys

Dashboard → **Project Settings → API Keys**. There are two separate panels and
they are easy to confuse — copying the wrong one is the single most common
setup mistake:

| Env var | Panel | Prefix | Exposure |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable keys | `sb_publishable_…` | Ships in the browser bundle. Public by design. |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret keys | `sb_secret_…` | Server only. Bypasses every auth check. Never prefix with `NEXT_PUBLIC_`. |

Older projects show JWT-shaped `anon` / `service_role` keys instead. Those
still work — `NEXT_PUBLIC_SUPABASE_ANON_KEY` is read as a fallback — but prefer
the new format on a fresh project.

### Auth settings

Dashboard → **Authentication → Providers**: email/password is enabled by
default, which is all this app uses. There is no public sign-up — staff are
provisioned by the owner through the admin API — so email confirmation
templates and redirect URLs don't gate anything today.

Still set **Authentication → URL Configuration → Site URL** to your Vercel
domain once you have it. Password-reset links use it, and leaving it on
`localhost` sends production users to a dead link.

---

## 2. Local setup against your project

```bash
cp .env.example .env
```

Fill in all five values from step 1, then:

```bash
npm run db:deploy   # applies all migrations, including the RLS lockdown
npm run db:seed     # optional: demo tenant + its Supabase Auth logins
npm run dev         # http://localhost:3001
```

`db:seed` is idempotent and safe to re-run. It needs `SUPABASE_SERVICE_ROLE_KEY`
because it creates the login accounts through the Supabase admin API. Skip it
entirely for a production database you intend to fill with real data.

Seeded logins, if you ran it — password `demo1234` for all:
`rizal@fadehouse.my` (owner), `siti@fadehouse.my` (cashier),
`adam@fadehouse.my` (barber), `admin@barberflow.io` (platform, at `/platform`).

**Change those passwords before the app is reachable from the internet.**

---

## 3. Deploy to Vercel

1. **Import the repo** in Vercel. Framework preset: Next.js. The defaults are
   correct — don't override the build command. `prisma generate` runs from
   `postinstall`, which matters because `src/generated/prisma` is git-ignored.

2. **Set environment variables** (Project Settings → Environment Variables).
   All five, for every environment you plan to use:

   ```
   DATABASE_URL                            # transaction pooler, port 6543
   DIRECT_URL                              # session pooler, port 5432
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
   SUPABASE_SERVICE_ROLE_KEY
   ```

   `DATABASE_URL` **must** be the transaction pooler here. Serverless functions
   open and drop connections constantly; pointing this at a session connection
   will exhaust the database's connection limit under any real traffic.

3. **Set the function region** (Project Settings → Functions) to whichever
   Vercel region is closest to your Supabase region. Every page in the portals
   is server-rendered and hits the database, so a mismatch here costs a
   round-trip on every request.

4. **Run migrations from your machine, not from the build.** With your `.env`
   pointing at the production project:

   ```bash
   npm run db:deploy
   ```

   Do this *before* the first deploy. Keeping migrations out of the build step
   means a failed migration can't leave you with a half-deployed app, and
   Vercel's build environment never needs `DIRECT_URL` credentials.

   The build does not connect to the database at all — verified by building
   with an unreachable `DATABASE_URL`. Every portal route is dynamic, so
   nothing is pre-rendered against real data.

5. **Deploy**, then set Supabase's Site URL to the resulting domain.

---

## 4. Verify the deployment

**Row-level security.** This is the check worth doing carefully. The
publishable key ships inside the browser bundle, so if Supabase's REST API can
read your tables, so can anyone with devtools. The migration
`20260820000000_lock_down_postgrest_access` closes this automatically, but
confirm it landed:

```bash
curl -s -H "apikey: $PUBLISHABLE_KEY" -H "Authorization: Bearer $PUBLISHABLE_KEY" \
  "https://<project-ref>.supabase.co/rest/v1/staff?select=*&limit=1"
```

Expected — anything else means the lockdown did not apply, and you should stop
and investigate before putting real data in:

```json
{"code":"42501","message":"permission denied for table staff"}
```

**Login.** Sign in at `/` and confirm you land on the right dashboard. Then try
a URL from another portal (e.g. `/owner/dashboard` while signed in as a
barber) — you should be redirected to your own dashboard, not shown the page.

**Sign out**, then hit a portal URL directly. You should get the login screen.

---

## 5. Troubleshooting

| Symptom | Cause |
|---|---|
| `ENOTFOUND db.<ref>.supabase.co` | Using the IPv6-only direct host. Switch to the pooler (§1). |
| `tenant/user not found` | Wrong region in the pooler hostname, or username isn't `postgres.<project-ref>`. |
| `"This account is not linked to a shop"` after a correct password | Supabase authenticated the user but no `staff` row matches their `authUserId`. Either the seed never ran against *this* database, or the app is talking to a different database than you migrated. |
| Same, only in local dev, right after editing `.env` | Next reloads `.env` in place without restarting. Restart `npm run dev`. |
| `This endpoint requires a valid Bearer token` from `db:seed` | `SUPABASE_SERVICE_ROLE_KEY` holds a publishable key, not a secret one (§1). |
| Migrations hang or fail on DDL | `DIRECT_URL` is pointed at port 6543. Transaction mode can't run DDL or hold advisory locks. |
| Connection limit exhausted in production | `DATABASE_URL` is pointed at port 5432 instead of the transaction pooler. |

---

## 6. Before real customers

- Rotate every `demo1234` password, or don't seed the demo tenant at all.
- Never commit `.env` — it is git-ignored, keep it that way.
- `SUPABASE_SERVICE_ROLE_KEY` bypasses all authorization. Only
  `src/lib/supabase/admin.ts` may read it, and only from server code.
- Adding a table? RLS is **not** inherited. See the Database section in
  `AGENTS.md` — new tables need an explicit
  `ALTER TABLE … ENABLE ROW LEVEL SECURITY` in their migration.
- Tenant isolation is enforced in application code, not by the database. Every
  query must filter on `tenantId`.

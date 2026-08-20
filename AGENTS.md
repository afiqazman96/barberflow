<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Database

Postgres is hosted on Supabase and reached exclusively through Prisma
(`src/lib/prisma.ts`), which connects as `postgres`. Supabase is used for auth
only — there are no supabase-js `.from()` data queries, and there should not be.

The `public` schema is deliberately closed to Supabase's REST API:
`20260820000000_lock_down_postgrest_access` revokes `anon` / `authenticated` and
enables RLS with no policies. The publishable key ships in the browser bundle,
so re-opening the schema exposes every table to anyone with devtools.

**When adding a table:** RLS is not inherited. The revoked default privileges
cover grants automatically, but a new table still starts with
`rowsecurity = false`, so append to your migration:

```sql
ALTER TABLE public.your_new_table ENABLE ROW LEVEL SECURITY;
```

If a screen ever genuinely needs to query from the browser, grant that one
table and write real RLS policies for it. Never re-grant the schema wholesale.

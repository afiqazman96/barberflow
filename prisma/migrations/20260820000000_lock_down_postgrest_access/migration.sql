-- Shut PostgREST out of the application schema.
--
-- Supabase serves every table in `public` over its REST API, and grants the
-- `anon` and `authenticated` roles access to tables created by `postgres` —
-- which is the role Prisma migrations run as. NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
-- ships inside the browser bundle, so without this migration anyone who opens
-- devtools can read and write `staff`, `sales` and `customers` straight over
-- https://<project>.supabase.co/rest/v1/.
--
-- This app never reads data through supabase-js — Supabase is used for auth
-- only, and all data access goes through Prisma as `postgres`. So the correct
-- posture is a blanket denial rather than per-table policies. If a screen ever
-- does need to query from the browser, grant that one table explicitly and give
-- it real RLS policies at the same time; do not re-open the schema wholesale.
--
-- Every statement is guarded on the Supabase roles existing, so this migration
-- is a no-op against a plain Postgres (local Docker, CI, Prisma's shadow
-- database) where `anon` and `authenticated` are not defined.

DO $$
DECLARE
  supabase_role text;
  target_table  text;
BEGIN
  FOREACH supabase_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM pg_roles WHERE rolname = supabase_role
    );

    -- Existing tables, and the sequences behind them.
    EXECUTE format(
      'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', supabase_role);
    EXECUTE format(
      'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', supabase_role);
    EXECUTE format(
      'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', supabase_role);

    -- Tables added by future migrations. Without this, the next `prisma migrate`
    -- would silently hand the new table back to PostgREST.
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I',
      supabase_role);
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I',
      supabase_role);

    -- The schema itself. PostgREST cannot reach a table it cannot traverse to,
    -- which is what makes the two REVOKEs above belt-and-braces rather than the
    -- only thing standing between the browser key and the data.
    EXECUTE format('REVOKE USAGE ON SCHEMA public FROM %I', supabase_role);
  END LOOP;

  -- Defence in depth: even if a grant is restored by hand or by a Supabase
  -- dashboard action, RLS with zero policies denies every row to every role
  -- except the table owner. Prisma connects as `postgres`, which owns these
  -- tables and therefore bypasses RLS, so the application is unaffected.
  FOR target_table IN
    SELECT tablename
      FROM pg_tables
     WHERE schemaname = 'public'
       AND tablename <> '_prisma_migrations'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target_table);
  END LOOP;
END
$$;

-- RLS is not inherited — new tables start with rowsecurity = false (see AGENTS.md).
-- The revoked default privileges already lock anon/authenticated out of these
-- tables; this just closes the schema's own RLS gate to match every other table.
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_sessions ENABLE ROW LEVEL SECURITY;

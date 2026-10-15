-- RLS is not inherited — new tables start with rowsecurity = false (see AGENTS.md).
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

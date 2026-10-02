-- The team, branches, chairs and the business profile move from the browser
-- into the shop snapshot. Screens hear about changes to them through the same
-- signal-only `shop_changed` Broadcast:
--
-- - a branch or a staff member changing pokes the whole tenant: a new branch
--   appears in every picker, and a transfer is news at both ends;
-- - a chair pokes its own branch;
-- - the shop's name (on `tenants`) pokes the whole tenant, like its settings.
--
-- Staff *status* keeps its own `staff_changed` event
-- (20261002000000_staff_status_broadcast); this one fires only for the
-- columns the snapshot carries, so clocking in doesn't poke twice for nothing.
CREATE OR REPLACE FUNCTION public.broadcast_shop_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  row_data jsonb;
  branch_ids text[];
  branch_id text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    row_data := to_jsonb(OLD);
  ELSE
    row_data := to_jsonb(NEW);
  END IF;

  IF to_regprocedure('realtime.send(jsonb, text, text, boolean)') IS NULL THEN
    RETURN NULL;
  END IF;

  BEGIN
    IF TG_TABLE_NAME = 'tenants' THEN
      SELECT array_agg(b.id) INTO branch_ids
      FROM public.branches b WHERE b."tenantId" = row_data->>'id';
    ELSIF TG_TABLE_NAME IN ('tenant_settings', 'commission_rules', 'services', 'products', 'membership_plans', 'customers', 'branches', 'staff') THEN
      SELECT array_agg(b.id) INTO branch_ids
      FROM public.branches b WHERE b."tenantId" = row_data->>'tenantId';
    ELSIF row_data ? 'branchId' THEN
      branch_ids := ARRAY[row_data->>'branchId'];
    ELSE
      SELECT array_agg(s."branchId") INTO branch_ids
      FROM public.staff s
      WHERE s.id = row_data->>'staffId' AND s."branchId" IS NOT NULL;
    END IF;

    FOREACH branch_id IN ARRAY coalesce(branch_ids, ARRAY[]::text[]) LOOP
      PERFORM realtime.send(
        jsonb_build_object('op', TG_OP),
        'shop_changed',
        'queue:branch:' || branch_id,
        false
      );
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    -- A failed poke must never roll back the write itself.
    RAISE WARNING 'shop broadcast failed: %', SQLERRM;
  END;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.broadcast_shop_change() FROM PUBLIC;

DROP TRIGGER IF EXISTS branches_broadcast ON public.branches;
CREATE TRIGGER branches_broadcast
AFTER INSERT OR UPDATE OR DELETE ON public.branches
FOR EACH ROW EXECUTE FUNCTION public.broadcast_shop_change();

DROP TRIGGER IF EXISTS chairs_broadcast ON public.chairs;
CREATE TRIGGER chairs_broadcast
AFTER INSERT OR UPDATE OR DELETE ON public.chairs
FOR EACH ROW EXECUTE FUNCTION public.broadcast_shop_change();

DROP TRIGGER IF EXISTS staff_team_broadcast ON public.staff;
CREATE TRIGGER staff_team_broadcast
AFTER INSERT OR DELETE OR UPDATE OF name, role, "branchId", "chairId", specialty, active, rating, "monthlyTarget", "avatarUrl", phone, email
ON public.staff
FOR EACH ROW EXECUTE FUNCTION public.broadcast_shop_change();

DROP TRIGGER IF EXISTS tenants_broadcast ON public.tenants;
CREATE TRIGGER tenants_broadcast
AFTER UPDATE OF name ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.broadcast_shop_change();

-- The settings trigger was AFTER UPDATE only; the first save for a shop with
-- no settings row is an insert, and should poke too.
DROP TRIGGER IF EXISTS tenant_settings_broadcast ON public.tenant_settings;
CREATE TRIGGER tenant_settings_broadcast
AFTER INSERT OR UPDATE ON public.tenant_settings
FOR EACH ROW EXECUTE FUNCTION public.broadcast_shop_change();

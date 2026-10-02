-- The catalogue (services, products, membership plans) and the customer list
-- move from the browser into the database. The tables already exist; what is
-- new is that screens hear about changes to them.
--
-- All four are tenant-wide, like the settings and commission rules: a change
-- pokes every branch with the same signal-only `shop_changed` Broadcast, and
-- screens re-read the shop snapshot, which carries the catalogue (and, for the
-- owner and counter only, the customers). No data on the socket — the topic is
-- public, and customers' phone numbers and emails never leave our server
-- except to staff who are signed in.
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
    IF TG_TABLE_NAME IN ('tenant_settings', 'commission_rules', 'services', 'products', 'membership_plans', 'customers') THEN
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

DROP TRIGGER IF EXISTS services_broadcast ON public.services;
CREATE TRIGGER services_broadcast
AFTER INSERT OR UPDATE OR DELETE ON public.services
FOR EACH ROW EXECUTE FUNCTION public.broadcast_shop_change();

DROP TRIGGER IF EXISTS products_broadcast ON public.products;
CREATE TRIGGER products_broadcast
AFTER INSERT OR UPDATE OR DELETE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.broadcast_shop_change();

DROP TRIGGER IF EXISTS membership_plans_broadcast ON public.membership_plans;
CREATE TRIGGER membership_plans_broadcast
AFTER INSERT OR UPDATE OR DELETE ON public.membership_plans
FOR EACH ROW EXECUTE FUNCTION public.broadcast_shop_change();

DROP TRIGGER IF EXISTS customers_broadcast ON public.customers;
CREATE TRIGGER customers_broadcast
AFTER INSERT OR UPDATE OR DELETE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.broadcast_shop_change();

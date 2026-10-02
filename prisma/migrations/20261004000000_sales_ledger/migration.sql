-- Sales move from the browser into the database.
--
-- 1. The shop's service charge and SST, so the server can work out a bill
--    itself rather than take the browser's word for it.
ALTER TABLE "tenant_settings"
  ADD COLUMN "serviceChargeEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "serviceChargeRate" DECIMAL(5,2) NOT NULL DEFAULT 10,
  ADD COLUMN "sstEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sstRate" DECIMAL(5,2) NOT NULL DEFAULT 8,
  ADD COLUMN "sstRegNo" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "taxAppliesTo" TEXT NOT NULL DEFAULT 'services';

-- 2. Everything a receipt shows, frozen at the moment of sale, and the void.
ALTER TABLE "sales"
  ADD COLUMN "customerName" TEXT NOT NULL DEFAULT 'Walk-in Customer',
  ADD COLUMN "customerEmail" TEXT,
  ADD COLUMN "staffName" TEXT,
  ADD COLUMN "membershipPlanId" TEXT,
  ADD COLUMN "discountReason" TEXT,
  ADD COLUMN "serviceCharge" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "serviceChargeRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN "tax" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN "tip" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "cardScheme" TEXT,
  ADD COLUMN "cardLast4" TEXT,
  ADD COLUMN "cardApprovalCode" TEXT,
  ADD COLUMN "rungById" TEXT,
  ADD COLUMN "rungByName" TEXT,
  ADD COLUMN "voidedAt" TIMESTAMP(3),
  ADD COLUMN "voidedById" TEXT,
  ADD COLUMN "voidedByName" TEXT,
  ADD COLUMN "voidReason" TEXT,
  ADD COLUMN "refundPending" BOOLEAN NOT NULL DEFAULT false;

-- 3. Receipt numbers, allocated per branch inside the sale's transaction.
CREATE TABLE "receipt_counters" (
    "branchId" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "receipt_counters_pkey" PRIMARY KEY ("branchId")
);

ALTER TABLE "receipt_counters" ADD CONSTRAINT "receipt_counters_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Closed to the REST API like every other table (20260820000000).
ALTER TABLE public.receipt_counters ENABLE ROW LEVEL SECURITY;

-- 4. Tell the branch's screens when its sales change (a payment, a void), the
--    same signal-only Broadcast as tickets and bookings. No sale data — the
--    topic is public.
CREATE OR REPLACE FUNCTION public.broadcast_sale_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  sale record;
BEGIN
  IF TG_OP = 'DELETE' THEN
    sale := OLD;
  ELSE
    sale := NEW;
  END IF;

  IF to_regprocedure('realtime.send(jsonb, text, text, boolean)') IS NOT NULL THEN
    BEGIN
      PERFORM realtime.send(
        jsonb_build_object('op', TG_OP),
        'sale_changed',
        'queue:branch:' || sale."branchId",
        false
      );
    EXCEPTION WHEN OTHERS THEN
      -- A failed poke must never roll back the sale itself.
      RAISE WARNING 'sale broadcast failed: %', SQLERRM;
    END;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.broadcast_sale_change() FROM PUBLIC;

DROP TRIGGER IF EXISTS sales_broadcast ON public.sales;
CREATE TRIGGER sales_broadcast
AFTER INSERT OR UPDATE OR DELETE ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_sale_change();

-- 5. Commission rules are tenant-wide, like the settings: a change pokes every
--    branch's set-up (the staff shop snapshot carries the rules and the tax
--    settings, so the POS works its numbers from the same ones the server does).
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
    IF TG_TABLE_NAME IN ('tenant_settings', 'commission_rules') THEN
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

DROP TRIGGER IF EXISTS commission_rules_broadcast ON public.commission_rules;
CREATE TRIGGER commission_rules_broadcast
AFTER INSERT OR UPDATE OR DELETE ON public.commission_rules
FOR EACH ROW EXECUTE FUNCTION public.broadcast_shop_change();

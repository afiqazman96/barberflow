-- The cash drawer moves from the browser into the database.

CREATE TYPE "CashMovementType" AS ENUM ('SALE', 'REFUND', 'PAY_IN', 'PAY_OUT');
CREATE TYPE "DrawerStatus" AS ENUM ('CLOSED', 'NEEDS_REVIEW', 'REVIEWED');

CREATE TABLE "drawer_sessions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "cashierId" TEXT,
    "cashierName" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openingFloat" DECIMAL(10,2) NOT NULL,
    "floatMismatch" DECIMAL(10,2),
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "closedByName" TEXT,
    "closedByOwner" BOOLEAN NOT NULL DEFAULT false,
    "countedAmount" DECIMAL(10,2),
    "denominations" JSONB,
    "counts" JSONB NOT NULL DEFAULT '[]',
    "expectedAtClose" DECIMAL(10,2),
    "variance" DECIMAL(10,2),
    "status" "DrawerStatus",
    "closingNote" TEXT,
    "varianceReason" TEXT,
    "reviewedById" TEXT,
    "reviewedByName" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,

    CONSTRAINT "drawer_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cash_movements" (
    "id" TEXT NOT NULL,
    "drawerId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "type" "CashMovementType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "note" TEXT NOT NULL,
    "category" TEXT,
    "saleId" TEXT,
    "byId" TEXT,
    "byName" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_movements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "drawer_sessions_branchId_openedAt_idx" ON "drawer_sessions"("branchId", "openedAt");
CREATE INDEX "cash_movements_drawerId_at_idx" ON "cash_movements"("drawerId", "at");

-- One till per branch: two cashiers can't both have a drawer open there.
CREATE UNIQUE INDEX "drawer_sessions_one_open_per_branch"
  ON "drawer_sessions"("branchId") WHERE "closedAt" IS NULL;

ALTER TABLE "drawer_sessions" ADD CONSTRAINT "drawer_sessions_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "drawer_sessions" ADD CONSTRAINT "drawer_sessions_cashierId_fkey"
  FOREIGN KEY ("cashierId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_drawerId_fkey"
  FOREIGN KEY ("drawerId") REFERENCES "drawer_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Closed to the REST API like every other table (20260820000000).
ALTER TABLE public.drawer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

-- Tell the branch's staff screens the till changed: the same signal-only
-- Broadcast as everything else on the branch topic. No amounts — the topic is
-- public, and the expected cash is not even for the cashier's eyes.
CREATE OR REPLACE FUNCTION public.broadcast_drawer_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  row_data record;
BEGIN
  IF TG_OP = 'DELETE' THEN
    row_data := OLD;
  ELSE
    row_data := NEW;
  END IF;

  IF to_regprocedure('realtime.send(jsonb, text, text, boolean)') IS NOT NULL THEN
    BEGIN
      PERFORM realtime.send(
        jsonb_build_object('op', TG_OP),
        'drawer_changed',
        'queue:branch:' || row_data."branchId",
        false
      );
    EXCEPTION WHEN OTHERS THEN
      -- A failed poke must never roll back the till write itself.
      RAISE WARNING 'drawer broadcast failed: %', SQLERRM;
    END;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.broadcast_drawer_change() FROM PUBLIC;

CREATE TRIGGER drawer_sessions_broadcast
AFTER INSERT OR UPDATE OR DELETE ON public.drawer_sessions
FOR EACH ROW EXECUTE FUNCTION public.broadcast_drawer_change();

CREATE TRIGGER cash_movements_broadcast
AFTER INSERT OR UPDATE OR DELETE ON public.cash_movements
FOR EACH ROW EXECUTE FUNCTION public.broadcast_drawer_change();
